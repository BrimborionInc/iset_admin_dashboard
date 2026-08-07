#!/usr/bin/env node

/*
 * Live TEST smoke for the Regional Manager two-step review workflow.
 *
 * The script creates disposable TEST Cognito staff users, runs a remote runner on
 * the TEST admin host against the deployed backend/bundle, then deletes Cognito,
 * DB, and generated object-storage residue. It intentionally treats the business
 * roles as ISET Coordinator, Regional Manager, and NWAC Administrator.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const EXPECTED_AWS_ACCOUNT = '124355655255';
const DEFAULT_PROFILE = 'nwac-test';
const DEFAULT_REGION = 'ca-central-1';
const DEFAULT_BUCKET = 'nwac-test-artifacts';
const DEFAULT_ADMIN_ENV = path.resolve(__dirname, '..', '.env.test');
const DEFAULT_PORTAL_ENV = path.resolve(__dirname, '..', '..', 'ISET-intake', '.env.test');
const DEFAULT_LOCAL_BASE_URL = 'http://127.0.0.1:5001';
const DEFAULT_PORTAL_LOCAL_BASE_URL = 'http://127.0.0.1:5000';
const EXPECTED_TEST_DATABASE = 'iset_intake';
const EXPECTED_TEST_DATABASE_HOSTNAME = 'ip-172-16-0-199';
const EXPECTED_TEST_DATABASE_PORT = 3306;
const EXPECTED_TEST_DATABASE_PRINCIPAL = 'app_admin@10.48.%';
const EXPECTED_AWS_ARN = 'arn:aws:iam::124355655255:user/CODEX_CLI_Admin';
const EXPECTED_TEST_ASG = 'nwac-test-asg';
const EXPECTED_TEST_STAFF_POOL = 'ca-central-1_uvypDUOwa';
const EXPECTED_TEST_STAFF_CLIENT = '28pk6qvqhcmagvhoctas5578i3';
const EXPECTED_TEST_APPLICANT_POOL = 'ca-central-1_NdVuhOCwE';
const EXPECTED_TEST_OBJECT_BUCKET = 'nwac-test-uploads-20251014';
const REMOTE_COMMAND_TIMEOUT_MS = 30 * 60 * 1000;
const REMOTE_EVIDENCE_MARKER = '@@TWO_STEP_REVIEW_SMOKE_EVIDENCE@@';
const REMOTE_EVIDENCE_TRANSPORT_VERSION = 1;

/*
 * This factory is intentionally self-contained. The local launcher serializes it
 * into the SSM runner, and focused local tests import the same implementation.
 */
function createLiveSchemaGuard({
  connection,
  expectedDatabase,
  expectedHost,
  expectedUser,
  expectedDatabaseHostname,
  expectedPort,
  expectedPrincipal,
  configuredDatabase,
  configuredHost,
  configuredUser,
  configuredPort,
  requiredTables,
  cryptoModule,
}) {
  if (!connection || typeof connection.query !== 'function' || typeof connection.execute !== 'function') {
    throw new Error('schema_guard_connection_invalid');
  }
  if (!/^[A-Za-z0-9_]+$/.test(String(expectedDatabase || ''))) {
    throw new Error('schema_guard_expected_database_invalid');
  }
  if (![expectedHost, expectedUser, expectedDatabaseHostname, expectedPrincipal, configuredDatabase, configuredHost, configuredUser].every(value => String(value || '').trim())) {
    throw new Error('schema_guard_expected_connection_identity_invalid');
  }
  if (!Number.isInteger(Number(expectedPort)) || Number(expectedPort) <= 0 || Number(configuredPort) !== Number(expectedPort)) {
    throw new Error('schema_guard_expected_connection_port_invalid');
  }
  const required = Array.from(new Set(requiredTables || []));
  if (!required.length || required.some(table => !/^[A-Za-z0-9_]+$/.test(String(table)))) {
    throw new Error('schema_guard_required_tables_invalid');
  }

  const IDENTITY_SQL =
    'SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION()';
  const SQL_KEYWORDS = new Set([
    'add', 'all', 'alter', 'and', 'as', 'asc', 'between', 'by', 'case', 'char',
    'collate', 'date', 'decimal', 'delete', 'desc', 'distinct',
    'duplicate', 'else', 'end', 'escape', 'exists', 'false', 'from', 'group',
    'having', 'in', 'insert', 'into', 'is', 'join', 'json', 'key', 'left', 'like',
    'limit', 'not', 'null', 'on', 'or', 'order', 'outer', 'regexp', 'right',
    'select', 'set', 'signed', 'then', 'true', 'unsigned', 'update', 'values',
    'when', 'where', 'with', 'year_month',
  ]);
  const TABLE_ALIAS_STOP_WORDS = new Set([
    'where', 'left', 'right', 'inner', 'outer', 'join', 'on', 'order', 'group',
    'limit', 'set', 'values', 'having', 'union', 'for', 'use', 'force',
  ]);
  const MYSQL_BUILTINS = new Set([
    'cast', 'count', 'current_date', 'json_extract', 'json_unquote', 'now',
  ]);
  const MYSQL_CAST_TARGET_TYPES = new Set([
    'binary', 'char', 'date', 'datetime', 'decimal', 'json', 'signed', 'time', 'unsigned', 'year_month',
  ]);

  const schema = new Map();
  const verifiedFunctions = new Set();
  let discoveredTables = null;
  let identity = null;
  let preflightComplete = false;
  let verifiedStatementCount = 0;
  const verifiedStatements = [];

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
    if (/^SHOW TABLES$/i.test(normalized)) return 'tables';
    if (/^SHOW CREATE TABLE `?[A-Za-z0-9_]+`?$/i.test(normalized)) return 'create';
    if (/^SHOW FULL COLUMNS FROM `?[A-Za-z0-9_]+`?$/i.test(normalized)) return 'columns';
    return null;
  }

  async function metadataQuery(sql) {
    const kind = metadataStatementKind(sql);
    if (!kind) {
      throw guardError('schema_guard_raw_query_not_metadata', String(sql).slice(0, 120));
    }
    if (kind === 'create' || kind === 'columns') {
      const match = /(?:TABLE|FROM)\s+`?([A-Za-z0-9_]+)`?$/i.exec(String(sql).trim());
      const table = normalizeIdentifier(match?.[1]);
      if (!table || !discoveredTables?.has(table)) {
        throw guardError('schema_guard_metadata_table_not_discovered', table || 'unknown');
      }
    }
    return connection.query(sql);
  }

  function extractTableRefs(maskedSql) {
    const refs = [];
    const patterns = [
      /^\s*INSERT\s+INTO\s+((?:`?[A-Za-z0-9_]+`?\.)?`?[A-Za-z0-9_]+`?)/gi,
      /^\s*UPDATE\s+((?:`?[A-Za-z0-9_]+`?\.)?`?[A-Za-z0-9_]+`?)(?:\s+(?:AS\s+)?(`?[A-Za-z_][A-Za-z0-9_]*`?))?/gi,
      /^\s*DELETE\s+FROM\s+((?:`?[A-Za-z0-9_]+`?\.)?`?[A-Za-z0-9_]+`?)(?:\s+(?:AS\s+)?(`?[A-Za-z_][A-Za-z0-9_]*`?))?/gi,
      /\b(?:FROM|JOIN)\s+((?:`?[A-Za-z0-9_]+`?\.)?`?[A-Za-z0-9_]+`?)(?:\s+(?:AS\s+)?(`?[A-Za-z_][A-Za-z0-9_]*`?))?/gi,
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(maskedSql))) {
        const parts = match[1].split('.').map(normalizeIdentifier);
        const database = parts.length === 2 ? parts[0] : null;
        const table = parts[parts.length - 1];
        let alias = normalizeIdentifier(match[2] || table);
        if (TABLE_ALIAS_STOP_WORDS.has(alias)) alias = table;
        refs.push({ database, table, alias });
      }
    }
    const unique = [];
    const seen = new Set();
    for (const ref of refs) {
      const key = `${ref.database || ''}.${ref.table}:${ref.alias}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(ref);
      }
    }
    return unique;
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
    const refs = extractTableRefs(masked);
    if (!refs.length) throw guardError('schema_guard_statement_has_no_table');
    const aliasMap = new Map();
    const tables = [];
    for (const ref of refs) {
      if (ref.database && ref.database !== normalizeIdentifier(expectedDatabase)) {
        throw guardError('schema_guard_cross_database_reference', `${ref.database}.${ref.table}`);
      }
      if (!schema.has(ref.table)) throw guardError('schema_guard_table_unverified', ref.table);
      aliasMap.set(ref.alias, ref.table);
      aliasMap.set(ref.table, ref.table);
      if (!tables.includes(ref.table)) tables.push(ref.table);
    }

    const outputAliases = new Set();
    for (const match of maskedWithIdentifiers.matchAll(/\bAS\s+(`[^`]+`|[A-Za-z_][A-Za-z0-9_]*)/gi)) {
      const rawAlias = match[1];
      if (rawAlias.startsWith('`')) {
        const alias = rawAlias.slice(1, -1);
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) {
          throw guardError('schema_guard_output_alias_invalid', alias);
        }
        outputAliases.add(normalizeIdentifier(alias));
      } else if (!isVerifiedCastTypeReference(maskedWithIdentifiers, match.index, rawAlias)) {
        throw guardError('schema_guard_output_alias_unquoted', rawAlias);
      }
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
      const owner = resolveColumnOwner(token, aliasMap, tables);
      assertColumn(owner.table, owner.column);
    }

    validateJoins(masked, aliasMap);
    validateEnumComparisons(text, masked, aliasMap, tables, params);
    validateInsertEnums(text, masked, refs, params);
    validateUpdateEnums(text, masked, refs, aliasMap, tables, params);
    return {
      tables: [...tables].sort(),
      functions: [...functions].sort(),
    };
  }

  async function preflight() {
    if (preflightComplete) throw guardError('schema_guard_preflight_already_complete');
    const [identityRows] = await metadataQuery(IDENTITY_SQL);
    const row = Array.isArray(identityRows) ? identityRows[0] : null;
    identity = {
      database: row?.['DATABASE()'] || null,
      host: row?.['@@hostname'] || null,
      port: Number(row?.['@@port'] || 0) || null,
      currentUser: row?.['CURRENT_USER()'] || null,
      version: row?.['VERSION()'] || null,
      configuredTarget: {
        host: configuredHost,
        user: configuredUser,
        database: configuredDatabase,
        port: Number(configuredPort),
      },
    };
    if (configuredDatabase !== expectedDatabase) {
      throw guardError('schema_guard_wrong_configured_database', `${configuredDatabase} != ${expectedDatabase}`);
    }
    if (configuredHost !== expectedHost) {
      throw guardError('schema_guard_wrong_configured_host', `${configuredHost} != ${expectedHost}`);
    }
    if (configuredUser !== expectedUser) {
      throw guardError('schema_guard_wrong_configured_user', `${configuredUser} != ${expectedUser}`);
    }
    if (identity.database !== expectedDatabase) {
      throw guardError('schema_guard_wrong_database', `${identity.database || 'null'} != ${expectedDatabase}`);
    }
    if (identity.host !== expectedDatabaseHostname) {
      throw guardError('schema_guard_wrong_database_hostname', `${identity.host || 'null'} != ${expectedDatabaseHostname}`);
    }
    if (identity.port !== Number(expectedPort)) {
      throw guardError('schema_guard_wrong_database_port', `${identity.port || 'null'} != ${expectedPort}`);
    }
    if (identity.currentUser !== expectedPrincipal) {
      throw guardError('schema_guard_wrong_database_principal', `${identity.currentUser || 'null'} != ${expectedPrincipal}`);
    }
    if (!identity.host || !identity.currentUser || !identity.port || !identity.version) {
      throw guardError('schema_guard_database_identity_incomplete');
    }
    const currentAccount = String(identity.currentUser).split('@')[0].replace(/^['`"]|['`"]$/g, '');
    if (currentAccount !== expectedUser) {
      throw guardError('schema_guard_wrong_database_user', `${currentAccount || 'null'} != ${expectedUser}`);
    }
    if (!/^8\./.test(String(identity.version))) {
      throw guardError('schema_guard_database_engine_unverified', identity.version);
    }
    const [tableRows] = await metadataQuery('SHOW TABLES');
    const discovered = new Set((tableRows || []).map(tableRow => normalizeIdentifier(Object.values(tableRow)[0])));
    discoveredTables = discovered;
    const missing = required.filter(table => !discovered.has(normalizeIdentifier(table)));
    if (missing.length) throw guardError('schema_guard_required_table_missing', missing.join(','));

    for (const requestedTable of required) {
      const table = normalizeIdentifier(requestedTable);
      const [createRows] = await metadataQuery(`SHOW CREATE TABLE ${quoteIdentifier(table)}`);
      const createRow = Array.isArray(createRows) ? createRows[0] : null;
      const createSql = createRow?.['Create Table'] || (createRow ? Object.values(createRow)[1] : null);
      if (!createSql) throw guardError('schema_guard_create_table_missing', table);
      const [columnRows] = await metadataQuery(`SHOW FULL COLUMNS FROM ${quoteIdentifier(table)}`);
      if (!Array.isArray(columnRows) || !columnRows.length) {
        throw guardError('schema_guard_full_columns_missing', table);
      }
      const columns = new Map();
      const checkAllowedValues = parseCheckAllowedValues(createSql);
      for (const columnRow of columnRows) {
        const name = normalizeIdentifier(columnRow.Field);
        if (!name) throw guardError('schema_guard_full_column_name_missing', table);
        const enumValues = parseEnumValues(columnRow.Type);
        columns.set(name, {
          type: String(columnRow.Type || ''),
          collation: columnRow.Collation || null,
          allowedValues: enumValues || checkAllowedValues.get(name) || null,
        });
      }
      const hashPayload = JSON.stringify({
        createSql,
        columns: columnRows.map(columnRow => ({
          field: columnRow.Field,
          type: columnRow.Type,
          collation: columnRow.Collation,
          nullable: columnRow.Null,
          key: columnRow.Key,
          defaultValue: columnRow.Default,
          extra: columnRow.Extra,
        })),
      });
      schema.set(table, {
        columns,
        foreignKeys: parseForeignKeys(createSql),
        ddlHash: cryptoModule.createHash('sha256').update(hashPayload).digest('hex'),
      });
    }
    preflightComplete = true;
    return evidence();
  }

  async function execute(sql, params = []) {
    const proof = validateStatement(sql, params);
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

  function evidence() {
    return {
      identity: identity ? { ...identity } : null,
      ddlHashes: Object.fromEntries(Array.from(schema.entries()).map(([table, proof]) => [table, proof.ddlHash])),
      verifiedStatementCount,
      verifiedStatements: verifiedStatements.map(statement => ({ ...statement })),
      verifiedFunctions: Array.from(verifiedFunctions).sort(),
      preflightComplete,
    };
  }

  return {
    execute,
    evidence,
    metadataQuery,
    preflight,
    validateStatement,
  };
}

function parseArgs(argv) {
  const args = {
    profile: process.env.AWS_PROFILE || DEFAULT_PROFILE,
    region: process.env.AWS_REGION || DEFAULT_REGION,
    bucket: process.env.TWO_STEP_REVIEW_SMOKE_BUCKET || DEFAULT_BUCKET,
    instanceId: process.env.TWO_STEP_REVIEW_SMOKE_INSTANCE_ID || '',
    adminEnv: process.env.TWO_STEP_REVIEW_SMOKE_ADMIN_ENV || DEFAULT_ADMIN_ENV,
    portalEnv: process.env.TWO_STEP_REVIEW_SMOKE_PORTAL_ENV || DEFAULT_PORTAL_ENV,
    keepFixture: false,
    schemaPreflightOnly: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--profile') args.profile = argv[++index];
    else if (token === '--region') args.region = argv[++index];
    else if (token === '--bucket') args.bucket = argv[++index];
    else if (token === '--instance-id') args.instanceId = argv[++index];
    else if (token === '--admin-env') args.adminEnv = argv[++index];
    else if (token === '--portal-env') args.portalEnv = argv[++index];
    else if (token === '--keep-fixture') {
      throw new Error('--keep-fixture is disabled: release smoke must prove zero TEST residue.');
    }
    else if (token === '--schema-preflight-only') args.schemaPreflightOnly = true;
    else if (token === '--json') args.json = true;
    else if (token === '--help' || token === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  return args;
}

function usage() {
  console.log([
    'Usage: node scripts/two-step-review-test-smoke.js [options]',
    '',
    'Creates disposable TEST staff users and fixtures, exercises deployed TEST',
    'two-step review behavior, verifies artifacts/notifications, then cleans up.',
    '',
    'Options:',
    '  --instance-id ID   Run on a specific online nwac-test-app instance.',
    '  --schema-preflight-only  Prove live TEST identities/DDL without creating fixtures.',
    '  --profile NAME     AWS profile. Default: nwac-test.',
    '  --region REGION    AWS region. Default: ca-central-1.',
    '  --bucket NAME      Temporary S3 bucket. Default: nwac-test-artifacts.',
    '  --admin-env PATH   Admin .env.test used for staff pool values.',
    '  --portal-env PATH  Portal .env.test used for participant pool values.',
    '  --json             Emit JSON summary.',
  ].join('\n'));
}

function readEnvFile(filePath) {
  const env = {};
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equals = trimmed.indexOf('=');
    if (equals < 0) continue;
    const key = trimmed.slice(0, equals).trim();
    let value = trimmed.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function aws(args, options) {
  const allArgs = [
    ...args,
    '--region',
    options.region,
    '--profile',
    options.profile,
  ];
  return execFileSync('aws', allArgs, {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 30 * 1024 * 1024,
  });
}

function awsJson(args, options) {
  const out = aws([...args, '--output', 'json'], options).trim();
  return out ? JSON.parse(out) : null;
}

function awsText(args, options) {
  return aws([...args, '--output', 'text'], options).trim();
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function randomSuffix() {
  return crypto.randomBytes(5).toString('hex');
}

function randomPassword() {
  return `TwoStep#${crypto.randomBytes(9).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 12)}aA1!`;
}

function createEncryptedFixtureEnvelope(payload, publicKeyPem) {
  if (!publicKeyPem || !String(publicKeyPem).includes('BEGIN PUBLIC KEY')) {
    throw new Error('credential_transport_public_key_invalid');
  }
  const contentKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', contentKey, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();
  const encryptedKey = crypto.publicEncrypt({
    key: publicKeyPem,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256',
  }, contentKey);
  contentKey.fill(0);
  return JSON.stringify({
    version: 1,
    keyAlgorithm: 'rsa-oaep-sha256',
    contentAlgorithm: 'aes-256-gcm',
    encryptedKey: encryptedKey.toString('base64'),
    iv: iv.toString('base64'),
    authenticationTag: authenticationTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  });
}

function discoverInstanceId(options) {
  const online = new Set(
    awsText([
      'ssm',
      'describe-instance-information',
      '--query',
      'InstanceInformationList[?PingStatus==`Online`].InstanceId',
    ], options).split(/\s+/).filter(Boolean)
  );
  const running = awsText([
    'ec2',
    'describe-instances',
    '--filters',
    'Name=tag:Name,Values=nwac-test-app',
    'Name=instance-state-name,Values=running',
    '--query',
    'Reservations[].Instances[].InstanceId',
  ], options).split(/\s+/).filter(Boolean);
  const assertAsg = (instanceId) => {
    const rows = awsJson([
      'autoscaling',
      'describe-auto-scaling-instances',
      '--instance-ids',
      instanceId,
      '--query',
      'AutoScalingInstances[].{InstanceId:InstanceId,AutoScalingGroupName:AutoScalingGroupName,LifecycleState:LifecycleState}',
    ], options) || [];
    const row = rows.find(item => item?.InstanceId === instanceId);
    if (row?.AutoScalingGroupName !== EXPECTED_TEST_ASG || row?.LifecycleState !== 'InService') {
      throw new Error(
        `Instance ${instanceId} is not an InService member of expected TEST ASG ${EXPECTED_TEST_ASG}.`
      );
    }
    return row;
  };
  if (options.instanceId) {
    if (!online.has(options.instanceId) || !running.includes(options.instanceId)) {
      throw new Error(`Requested instance ${options.instanceId} is not an online, running nwac-test-app instance.`);
    }
    assertAsg(options.instanceId);
    return options.instanceId;
  }
  const match = running.find(instanceId => online.has(instanceId));
  if (!match) throw new Error('No online SSM-managed nwac-test-app instance found.');
  assertAsg(match);
  return match;
}

function discoverInstanceRoleExpectation(instanceId, options) {
  const instanceProfileArn = awsText([
    'ec2',
    'describe-instances',
    '--instance-ids',
    instanceId,
    '--query',
    'Reservations[0].Instances[0].IamInstanceProfile.Arn',
  ], options);
  const profileMatch = /^arn:aws:iam::(\d{12}):instance-profile\/(.+)$/.exec(instanceProfileArn);
  if (!profileMatch || profileMatch[1] !== EXPECTED_AWS_ACCOUNT || !profileMatch[2]) {
    throw new Error(`Instance ${instanceId} has an unverified IAM instance profile: ${instanceProfileArn || 'missing'}.`);
  }
  const profile = awsJson([
    'iam',
    'get-instance-profile',
    '--instance-profile-name',
    profileMatch[2],
    '--query',
    'InstanceProfile.{Arn:Arn,Roles:Roles[].{Arn:Arn,RoleName:RoleName,RoleId:RoleId}}',
  ], options);
  if (profile?.Arn !== instanceProfileArn || !Array.isArray(profile?.Roles) || profile.Roles.length !== 1) {
    throw new Error(`Instance ${instanceId} IAM instance profile did not resolve to exactly one verified role.`);
  }
  const role = profile.Roles[0];
  const expectedRolePrefix = `arn:aws:iam::${EXPECTED_AWS_ACCOUNT}:role/`;
  if (
    !String(role?.Arn || '').startsWith(expectedRolePrefix) ||
    !/^[A-Za-z0-9+=,.@_-]+$/.test(String(role?.RoleName || '')) ||
    !/^[A-Z0-9]+$/.test(String(role?.RoleId || ''))
  ) {
    throw new Error(`Instance ${instanceId} IAM role identity was incomplete or outside the TEST account.`);
  }
  return {
    instanceProfileArn,
    roleArn: role.Arn,
    roleName: role.RoleName,
    roleId: role.RoleId,
  };
}

function discoverRemoteAwsIdentity(instanceId, options) {
  const marker = '@@REMOTE_AWS_IDENTITY@@';
  const discoverySource = [
    "require('dotenv').config({ path: '/opt/nwac/admin-dashboard/.env.test' })",
    "require('dotenv').config({ path: '/opt/nwac/admin-dashboard/.env' })",
    "const { execFileSync } = require('child_process')",
    `const output = execFileSync('aws', ['sts', 'get-caller-identity', '--region', ${JSON.stringify(options.region)}, '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })`,
    `process.stdout.write(${JSON.stringify(marker)} + output)`,
  ].join(';');
  const commandId = sendRemoteCommand(instanceId, [
    'set -euo pipefail',
    'cd /opt/nwac/admin-dashboard',
    `node -e ${shellQuote(discoverySource)}`,
  ], 'Codex two-step review remote AWS identity discovery', options);
  const invocation = waitForCommand(instanceId, commandId, options);
  if (invocation?.Status !== 'Success') {
    throw new Error(`Remote AWS identity discovery failed with status ${invocation?.Status || 'unknown'}.`);
  }
  const stdout = String(invocation?.Stdout || '');
  const markerIndex = stdout.lastIndexOf(marker);
  if (markerIndex < 0) throw new Error('Remote AWS identity discovery emitted no marker.');
  let identity;
  try {
    identity = JSON.parse(stdout.slice(markerIndex + marker.length).trim());
  } catch (_) {
    throw new Error('Remote AWS identity discovery emitted invalid JSON.');
  }
  const account = String(identity?.Account || '');
  const arn = String(identity?.Arn || '');
  const userId = String(identity?.UserId || '');
  if (
    account !== EXPECTED_AWS_ACCOUNT ||
    (
      !arn.startsWith(`arn:aws:iam::${EXPECTED_AWS_ACCOUNT}:`) &&
      !arn.startsWith(`arn:aws:sts::${EXPECTED_AWS_ACCOUNT}:`)
    ) ||
    !userId
  ) {
    throw new Error(`Remote AWS identity was incomplete or outside TEST: ${arn || 'missing'}.`);
  }
  return { account, arn, userId };
}

function createStaffUser({ email, password, givenName, familyName, poolId, groupName }, options) {
  aws([
    'cognito-idp',
    'admin-create-user',
    '--user-pool-id',
    poolId,
    '--username',
    email,
    '--message-action',
    'SUPPRESS',
    '--user-attributes',
    `Name=email,Value=${email}`,
    'Name=email_verified,Value=true',
    `Name=preferred_username,Value=${email}`,
    `Name=given_name,Value=${givenName}`,
    `Name=family_name,Value=${familyName}`,
  ], options);
  aws([
    'cognito-idp',
    'admin-set-user-password',
    '--user-pool-id',
    poolId,
    '--username',
    email,
    '--password',
    password,
    '--permanent',
  ], options);
  aws([
    'cognito-idp',
    'admin-add-user-to-group',
    '--user-pool-id',
    poolId,
    '--username',
    email,
    '--group-name',
    groupName,
  ], options);
  const user = awsJson([
    'cognito-idp',
    'admin-get-user',
    '--user-pool-id',
    poolId,
    '--username',
    email,
  ], options);
  const sub = (user.UserAttributes || []).find(attribute => attribute.Name === 'sub')?.Value;
  if (!sub) throw new Error(`Unable to resolve Cognito sub for ${email}`);
  return sub;
}

function createApplicantUser({ email, password, poolId }, options) {
  aws([
    'cognito-idp',
    'admin-create-user',
    '--user-pool-id',
    poolId,
    '--username',
    email,
    '--message-action',
    'SUPPRESS',
    '--user-attributes',
    `Name=email,Value=${email}`,
    'Name=email_verified,Value=true',
    'Name=given_name,Value=Two',
    'Name=family_name,Value=StepApplicant',
  ], options);
  aws([
    'cognito-idp',
    'admin-set-user-password',
    '--user-pool-id',
    poolId,
    '--username',
    email,
    '--password',
    password,
    '--permanent',
  ], options);
  const user = awsJson([
    'cognito-idp',
    'admin-get-user',
    '--user-pool-id',
    poolId,
    '--username',
    email,
  ], options);
  const sub = (user.UserAttributes || []).find(attribute => attribute.Name === 'sub')?.Value;
  if (!sub) throw new Error(`Unable to resolve applicant Cognito sub for ${email}`);
  return sub;
}

function authenticateStaffUser({ email, password, poolId, clientId }, options) {
  if (!clientId) throw new Error('Cognito staff client id not found in admin env.');
  const flows = [
    ['admin-initiate-auth', 'ADMIN_USER_PASSWORD_AUTH', ['--user-pool-id', poolId]],
    ['initiate-auth', 'USER_PASSWORD_AUTH', []],
  ];
  const errors = [];
  for (const [command, flow, extraArgs] of flows) {
    try {
      const response = awsJson([
        'cognito-idp',
        command,
        ...extraArgs,
        '--client-id',
        clientId,
        '--auth-flow',
        flow,
        '--auth-parameters',
        `USERNAME=${email},PASSWORD=${password}`,
      ], options);
      if (response?.ChallengeName) {
        throw new Error(`Unexpected Cognito auth challenge: ${response.ChallengeName}`);
      }
      const auth = response?.AuthenticationResult;
      if (!auth?.IdToken || !auth?.AccessToken) {
        throw new Error('Cognito auth response did not include ID/access tokens.');
      }
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = Number(auth.ExpiresIn || 3600);
      return {
        idToken: auth.IdToken,
        accessToken: auth.AccessToken,
        expiresAt: now + expiresIn - 60,
      };
    } catch (error) {
      const message = String(error.stderr || error.message || error).split('\n')[0];
      errors.push(`${flow}: ${message}`);
    }
  }
  throw new Error(`Unable to authenticate ${email} through TEST Cognito client. ${errors.join(' | ')}`);
}

function deleteStaffUser({ email, poolId }, options) {
  try {
    aws([
      'cognito-idp',
      'admin-delete-user',
      '--user-pool-id',
      poolId,
      '--username',
      email,
    ], options);
  } catch (error) {
    const message = String(error.stderr || error.message || error);
    if (!/UserNotFoundException/.test(message)) {
      throw new Error(`Cognito delete failed for ${email}: ${message.split('\n')[0]}`);
    }
  }
  try {
    aws([
      'cognito-idp',
      'admin-get-user',
      '--user-pool-id',
      poolId,
      '--username',
      email,
    ], options);
  } catch (error) {
    const message = String(error.stderr || error.message || error);
    if (/UserNotFoundException/.test(message)) return;
    throw new Error(`Cognito cleanup verification failed for ${email}: ${message.split('\n')[0]}`);
  }
  throw new Error(`Cognito user ${email} still exists after cleanup.`);
}

function uploadRemoteScript(remoteScript, key, options) {
  const tempFile = path.join(os.tmpdir(), `two-step-review-smoke-${process.pid}-${Date.now()}.js`);
  fs.writeFileSync(tempFile, remoteScript, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  try {
    aws([
      's3',
      'cp',
      tempFile,
      `s3://${options.bucket}/${key}`,
      '--only-show-errors',
      '--sse',
      'AES256',
    ], options);
  } finally {
    fs.rmSync(tempFile, { force: true });
  }
}

function deleteRemoteScript(key, options, bucket = options.bucket) {
  try {
    aws([
      's3',
      'rm',
      `s3://${bucket}/${key}`,
      '--only-show-errors',
    ], options);
  } catch (error) {
    throw new Error(`Temporary smoke script deletion failed: ${String(error.stderr || error.message || error).split('\n')[0]}`);
  }
  const listExactVersions = () => {
    const response = awsJson([
      's3api',
      'list-object-versions',
      '--bucket',
      bucket,
      '--prefix',
      key,
    ], options) || {};
    return [
      ...(response.Versions || []),
      ...(response.DeleteMarkers || []),
    ].filter(item => item?.Key === key && item?.VersionId);
  };
  for (const item of listExactVersions()) {
    aws([
      's3api',
      'delete-object',
      '--bucket',
      bucket,
      '--key',
      key,
      '--version-id',
      item.VersionId,
    ], options);
  }
  const remainingVersions = listExactVersions();
  if (remainingVersions.length) {
    throw new Error(`Temporary smoke object ${key} still has ${remainingVersions.length} version(s) or delete marker(s).`);
  }
  try {
    aws([
      's3api',
      'head-object',
      '--bucket',
      bucket,
      '--key',
      key,
    ], options);
  } catch (error) {
    const message = String(error.stderr || error.message || error);
    if (/Not Found|404|NoSuchKey/i.test(message)) return;
    throw new Error(`Temporary smoke script cleanup verification failed: ${message.split('\n')[0]}`);
  }
  throw new Error(`Temporary smoke script s3://${bucket}/${key} still exists after cleanup.`);
}

function deleteRemoteCredentialKey(instanceId, keyPath, options) {
  if (!/^\/tmp\/two-step-review-smoke-[A-Za-z0-9-]+\.credential\.pem$/.test(String(keyPath || ''))) {
    throw new Error('Remote credential key cleanup path was not an exact smoke-owned path.');
  }
  const marker = 'credential-key-absent';
  const commandId = sendRemoteCommand(instanceId, [
    'set -euo pipefail',
    `rm -f ${shellQuote(keyPath)}`,
    `test ! -e ${shellQuote(keyPath)}`,
    `echo ${shellQuote(marker)}`,
  ], 'Codex two-step review credential key cleanup', options);
  const invocation = waitForCommand(instanceId, commandId, options);
  if (invocation?.Status !== 'Success' || !String(invocation?.Stdout || '').includes(marker)) {
    throw new Error(`Remote credential key cleanup failed with status ${invocation?.Status || 'unknown'}.`);
  }
}

function sendRemoteCommand(instanceId, commandLines, comment, options) {
  const paramsFile = path.join(os.tmpdir(), `two-step-review-params-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(paramsFile, JSON.stringify({ commands: commandLines }), 'utf8');
  try {
    return awsText([
      'ssm',
      'send-command',
      '--instance-ids',
      instanceId,
      '--document-name',
      'AWS-RunShellScript',
      '--parameters',
      `file://${paramsFile}`,
      '--comment',
      comment,
      '--query',
      'Command.CommandId',
    ], options);
  } finally {
    fs.rmSync(paramsFile, { force: true });
  }
}

function waitForCommand(instanceId, commandId, options) {
  const startedAt = Date.now();
  for (;;) {
    if (Date.now() - startedAt > REMOTE_COMMAND_TIMEOUT_MS) {
      throw new Error(`SSM command ${commandId} exceeded the bounded ${REMOTE_COMMAND_TIMEOUT_MS}ms wait.`);
    }
    let invocation = null;
    try {
      invocation = awsJson([
        'ssm',
        'get-command-invocation',
        '--command-id',
        commandId,
        '--instance-id',
        instanceId,
        '--query',
        '{Status:Status,Stdout:StandardOutputContent,Stderr:StandardErrorContent}',
      ], options);
    } catch (_) {
      invocation = null;
    }
    const status = invocation?.Status || '';
    if (['Pending', 'InProgress', 'Delayed', ''].includes(status)) {
      execFileSync('sleep', ['2.5']);
      continue;
    }
    return invocation;
  }
}

function parseRemoteEvidencePointer(stdout) {
  const index = String(stdout || '').lastIndexOf(REMOTE_EVIDENCE_MARKER);
  if (index < 0) return null;
  const firstLine = String(stdout)
    .slice(index + REMOTE_EVIDENCE_MARKER.length)
    .split(/\r?\n/, 1)[0]
    .trim();
  try {
    const pointer = JSON.parse(firstLine);
    if (
      pointer?.transportVersion !== REMOTE_EVIDENCE_TRANSPORT_VERSION ||
      !['passed', 'failed'].includes(pointer?.status) ||
      pointer?.artifact?.bucket !== EXPECTED_TEST_OBJECT_BUCKET ||
      !/^smoke-evidence\/two-step-review-smoke-[A-Za-z0-9-]+(?:-preflight)?\.json$/.test(String(pointer?.artifact?.key || '')) ||
      !/^[a-f0-9]{64}$/.test(String(pointer?.artifact?.sha256 || '')) ||
      !Number.isInteger(Number(pointer?.artifact?.bytes)) ||
      Number(pointer.artifact.bytes) <= 0
    ) {
      return null;
    }
    return pointer;
  } catch (_) {
    return null;
  }
}

function downloadRemoteEvidence(pointer, stamp, label, options) {
  const safeLabel = label === 'preflight' ? 'preflight' : 'journey';
  const expectedKey = `smoke-evidence/two-step-review-smoke-${stamp}${safeLabel === 'preflight' ? '-preflight' : ''}.json`;
  if (pointer?.artifact?.bucket !== EXPECTED_TEST_OBJECT_BUCKET || pointer?.artifact?.key !== expectedKey) {
    throw new Error(`Remote evidence pointer did not match the exact smoke-owned ${safeLabel} key.`);
  }
  const evidenceDir = path.resolve(__dirname, '..', 'tmp', 'two-step-review-test-smoke');
  fs.mkdirSync(evidenceDir, { recursive: true });
  const localPath = path.join(evidenceDir, `${stamp}-${safeLabel}.json`);
  aws([
    's3',
    'cp',
    `s3://${EXPECTED_TEST_OBJECT_BUCKET}/${expectedKey}`,
    localPath,
    '--only-show-errors',
  ], options);
  const bytes = fs.readFileSync(localPath);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== Number(pointer.artifact.bytes) || sha256 !== pointer.artifact.sha256) {
    throw new Error(`Remote ${safeLabel} evidence hash/size verification failed.`);
  }
  let result;
  try {
    result = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`Remote ${safeLabel} detailed evidence was not valid JSON: ${error.message}`);
  }
  if (result?.status !== pointer.status || result?.finishedAt !== pointer.finishedAt) {
    throw new Error(`Remote ${safeLabel} detailed evidence did not match its compact SSM pointer.`);
  }
  return { result, localPath, sha256, bytes: bytes.length, key: expectedKey };
}

function summarizeResult(result) {
  const rows = [];
  for (const item of result?.checks || []) {
    rows.push(`${item.status.padEnd(4)} ${item.name}`);
  }
  return rows.join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.region !== DEFAULT_REGION) {
    throw new Error(`Region ${options.region} did not match expected TEST region ${DEFAULT_REGION}.`);
  }
  if (options.bucket !== DEFAULT_BUCKET) {
    throw new Error(`Staging bucket ${options.bucket} did not match expected TEST artifact bucket ${DEFAULT_BUCKET}.`);
  }
  const identity = awsJson(['sts', 'get-caller-identity'], options);
  if (identity?.Account !== EXPECTED_AWS_ACCOUNT) {
    throw new Error(
      `AWS account ${identity?.Account || 'unknown'} did not match expected TEST account ${EXPECTED_AWS_ACCOUNT}`
    );
  }
  if (identity?.Arn !== EXPECTED_AWS_ARN) {
    throw new Error(`AWS principal ${identity?.Arn || 'unknown'} did not match expected TEST operator ${EXPECTED_AWS_ARN}.`);
  }
  if (!fs.existsSync(options.adminEnv)) {
    throw new Error(`Admin env file not found: ${options.adminEnv}`);
  }
  if (!fs.existsSync(options.portalEnv)) {
    throw new Error(`Portal env file not found: ${options.portalEnv}`);
  }
  const adminEnv = readEnvFile(options.adminEnv);
  const portalEnv = readEnvFile(options.portalEnv);
  const expectedDbHost = String(adminEnv.DB_HOST || '').trim();
  const expectedDbUser = String(adminEnv.DB_USER || '').trim();
  const expectedDbName = String(adminEnv.DB_NAME || '').trim();
  const expectedDbPort = Number(adminEnv.DB_PORT || 3306);
  const expectedObjectBucket = String(adminEnv.OBJECT_BUCKET || '').trim();
  if (!expectedDbHost || !expectedDbUser || !expectedDbName) {
    throw new Error('Admin .env.test must define DB_HOST, DB_USER, and DB_NAME for TEST identity proof.');
  }
  if (expectedDbName !== EXPECTED_TEST_DATABASE) {
    throw new Error(`Admin .env.test DB_NAME ${expectedDbName} did not match expected TEST database ${EXPECTED_TEST_DATABASE}.`);
  }
  if (expectedDbPort !== EXPECTED_TEST_DATABASE_PORT) {
    throw new Error(`Admin .env.test DB_PORT ${expectedDbPort} did not match expected TEST port ${EXPECTED_TEST_DATABASE_PORT}.`);
  }
  if (!expectedObjectBucket || expectedObjectBucket !== String(portalEnv.OBJECT_BUCKET || '').trim()) {
    throw new Error('Admin and portal .env.test must name the same nonempty TEST OBJECT_BUCKET.');
  }
  const poolId =
    adminEnv.COGNITO_STAFF_USER_POOL_ID ||
    adminEnv.COGNITO_USER_POOL_ID;
  if (!poolId) throw new Error('COGNITO_STAFF_USER_POOL_ID not found in admin env.');
  const clientId =
    adminEnv.COGNITO_STAFF_CLIENT_ID ||
    adminEnv.COGNITO_CLIENT_ID ||
    adminEnv.REACT_APP_COGNITO_CLIENT_ID;
  if (!clientId) throw new Error('COGNITO_STAFF_CLIENT_ID not found in admin env.');
  const applicantPoolId =
    portalEnv.COGNITO_APPLICANT_USER_POOL_ID ||
    portalEnv.COGNITO_PORTAL_USER_POOL_ID ||
    portalEnv.COGNITO_USER_POOL_ID;
  if (!applicantPoolId) throw new Error('COGNITO_USER_POOL_ID not found in portal env.');
  if (poolId !== EXPECTED_TEST_STAFF_POOL || clientId !== EXPECTED_TEST_STAFF_CLIENT) {
    throw new Error('Admin .env.test Cognito pool/client did not match the authorized TEST staff identity target.');
  }
  if (applicantPoolId !== EXPECTED_TEST_APPLICANT_POOL) {
    throw new Error('Portal .env.test Cognito pool did not match the authorized TEST applicant identity target.');
  }
  if (expectedObjectBucket !== EXPECTED_TEST_OBJECT_BUCKET) {
    throw new Error(`OBJECT_BUCKET ${expectedObjectBucket} did not match authorized TEST bucket ${EXPECTED_TEST_OBJECT_BUCKET}.`);
  }

  const suffix = randomSuffix();
  const stamp = `two-step-${Date.now()}-${suffix}`;
  const credentialKeyPath = `/tmp/two-step-review-smoke-${stamp}.credential.pem`;
  const staffUsers = [
    {
      key: 'coordinator',
      email: `codex.twostep.${suffix}.coord@example.com`,
      password: randomPassword(),
      givenName: 'Codex',
      familyName: `Coordinator ${suffix}`,
      role: 'ISET Coordinator',
      groupName: 'ISET_Coordinator',
    },
    {
      key: 'manager',
      email: `codex.twostep.${suffix}.rm@example.com`,
      password: randomPassword(),
      givenName: 'Codex',
      familyName: `Manager ${suffix}`,
      role: 'Regional Manager',
      groupName: 'Regional_Manager',
    },
    {
      key: 'decisionMaker',
      email: `codex.twostep.${suffix}.nwac@example.com`,
      password: randomPassword(),
      givenName: 'Codex',
      familyName: `Decision ${suffix}`,
      role: 'NWAC Administrator',
      groupName: 'NWAC_Administrator',
    },
  ];
  const createdUsers = [];
  const applicantUser = {
    email: `codex.twostep.${suffix}.applicant@example.com`,
    password: randomPassword(),
    sub: null,
  };
  let remoteKey = null;
  let remoteConfigKey = null;
  let instanceId = null;
  let instanceRoleExpectation = null;
  let remoteAwsIdentityExpectation = null;
  let result = null;
  const remoteEvidenceKeys = new Set();
  const retainedEvidenceArtifacts = [];

  try {
    console.log('[two-step-smoke] Discovering TEST app instance...');
    instanceId = discoverInstanceId(options);
    instanceRoleExpectation = discoverInstanceRoleExpectation(instanceId, options);
    remoteAwsIdentityExpectation = discoverRemoteAwsIdentity(instanceId, options);
    console.log(`[two-step-smoke] Using ${instanceId}`);

    remoteKey = `ssm-scripts/two-step-review-smoke-${stamp}.js`;
    uploadRemoteScript(
      `const createLiveSchemaGuard = ${createLiveSchemaGuard.toString()};\n(${remoteRunner.toString()})();\n`,
      remoteKey,
      options
    );

    const runRemote = ({ preflightOnly = false } = {}) => {
      const remotePath = `/tmp/two-step-review-smoke-${stamp}${preflightOnly ? '-preflight' : ''}.js`;
      const remoteConfigPath = `/tmp/two-step-review-smoke-${stamp}.config.enc.json`;
      const remoteEvidenceKey = `smoke-evidence/two-step-review-smoke-${stamp}${preflightOnly ? '-preflight' : ''}.json`;
      remoteEvidenceKeys.add(remoteEvidenceKey);
      const commandLines = [
        'set -euo pipefail',
        `aws s3 cp ${shellQuote(`s3://${options.bucket}/${remoteKey}`)} ${shellQuote(remotePath)} --region ${shellQuote(options.region)} --only-show-errors`,
        ...(preflightOnly ? [] : [
          `aws s3 cp ${shellQuote(`s3://${options.bucket}/${remoteConfigKey}`)} ${shellQuote(remoteConfigPath)} --region ${shellQuote(options.region)} --only-show-errors`,
          `chmod 600 ${shellQuote(remoteConfigPath)}`,
        ]),
        `trap 'rm -f ${shellQuote(remotePath)} ${shellQuote(remoteConfigPath)}${preflightOnly ? '' : ` ${shellQuote(credentialKeyPath)}`}' EXIT`,
        'cd /opt/nwac/admin-dashboard',
        [
          `FIXTURE_STAMP=${shellQuote(preflightOnly ? `${stamp}-preflight` : stamp)}`,
          `SCHEMA_PREFLIGHT_ONLY=${preflightOnly ? '1' : '0'}`,
          `KEEP_FIXTURE=${options.keepFixture ? '1' : '0'}`,
          `TWO_STEP_REVIEW_EXPECTED_DB_NAME=${shellQuote(expectedDbName)}`,
          `TWO_STEP_REVIEW_EXPECTED_DB_HOST=${shellQuote(expectedDbHost)}`,
          `TWO_STEP_REVIEW_EXPECTED_DB_USER=${shellQuote(expectedDbUser)}`,
          `TWO_STEP_REVIEW_EXPECTED_DB_SERVER_HOSTNAME=${shellQuote(EXPECTED_TEST_DATABASE_HOSTNAME)}`,
          `TWO_STEP_REVIEW_EXPECTED_DB_PORT=${shellQuote(expectedDbPort)}`,
          `TWO_STEP_REVIEW_EXPECTED_DB_PRINCIPAL=${shellQuote(EXPECTED_TEST_DATABASE_PRINCIPAL)}`,
          `TWO_STEP_REVIEW_EXPECTED_OBJECT_BUCKET=${shellQuote(expectedObjectBucket)}`,
          `TWO_STEP_REVIEW_AWS_ACCOUNT=${shellQuote(identity.Account)}`,
          `TWO_STEP_REVIEW_AWS_ARN=${shellQuote(identity.Arn || '')}`,
          `TWO_STEP_REVIEW_INSTANCE_ID=${shellQuote(instanceId)}`,
          `TWO_STEP_REVIEW_EXPECTED_INSTANCE_PROFILE_ARN=${shellQuote(instanceRoleExpectation.instanceProfileArn)}`,
          `TWO_STEP_REVIEW_EXPECTED_INSTANCE_ROLE_ARN=${shellQuote(instanceRoleExpectation.roleArn)}`,
          `TWO_STEP_REVIEW_EXPECTED_INSTANCE_ROLE_NAME=${shellQuote(instanceRoleExpectation.roleName)}`,
          `TWO_STEP_REVIEW_EXPECTED_INSTANCE_ROLE_ID=${shellQuote(instanceRoleExpectation.roleId)}`,
          `TWO_STEP_REVIEW_EXPECTED_REMOTE_AWS_ACCOUNT=${shellQuote(remoteAwsIdentityExpectation.account)}`,
          `TWO_STEP_REVIEW_EXPECTED_REMOTE_AWS_ARN=${shellQuote(remoteAwsIdentityExpectation.arn)}`,
          `TWO_STEP_REVIEW_EXPECTED_REMOTE_AWS_USER_ID=${shellQuote(remoteAwsIdentityExpectation.userId)}`,
          `TWO_STEP_REVIEW_EVIDENCE_BUCKET=${shellQuote(expectedObjectBucket)}`,
          `TWO_STEP_REVIEW_EVIDENCE_KEY=${shellQuote(remoteEvidenceKey)}`,
          `TWO_STEP_REVIEW_CREDENTIAL_KEY_PATH=${shellQuote(credentialKeyPath)}`,
          `TWO_STEP_REVIEW_NOTIFICATION_WAIT_ATTEMPTS=${shellQuote(process.env.TWO_STEP_REVIEW_NOTIFICATION_WAIT_ATTEMPTS || '31')}`,
          `LOCAL_BASE_URL=${shellQuote(DEFAULT_LOCAL_BASE_URL)}`,
          `PORTAL_LOCAL_BASE_URL=${shellQuote(DEFAULT_PORTAL_LOCAL_BASE_URL)}`,
          ...(preflightOnly ? [] : [
            `TWO_STEP_REVIEW_CONFIG_ENVELOPE_FILE=${shellQuote(remoteConfigPath)}`,
          ]),
          `node ${shellQuote(remotePath)}`,
        ].join(' '),
        `rm -f ${shellQuote(remotePath)}`,
      ];
      const commandId = sendRemoteCommand(
        instanceId,
        commandLines,
        preflightOnly ? 'Codex two-step review TEST schema preflight' : 'Codex two-step review TEST smoke',
        options
      );
      console.log(`[two-step-smoke] SSM command ${commandId}`);
      const invocation = waitForCommand(instanceId, commandId, options);
      const pointer = parseRemoteEvidencePointer(invocation?.Stdout);
      let retained = null;
      if (pointer) {
        retained = downloadRemoteEvidence(pointer, stamp, preflightOnly ? 'preflight' : 'journey', options);
        retainedEvidenceArtifacts.push({
          label: preflightOnly ? 'preflight' : 'journey',
          localPath: retained.localPath,
          sha256: retained.sha256,
          bytes: retained.bytes,
        });
      }
      const remoteResult = retained?.result || null;
      if (invocation?.Status !== 'Success' || !remoteResult || remoteResult.status !== 'passed') {
        const stderr = invocation?.Stderr ? `\n${invocation.Stderr}` : '';
        const failedChecks = (remoteResult?.checks || []).filter(check => check.status === 'FAIL');
        const details = failedChecks.length ? `\n${JSON.stringify(failedChecks)}` : '';
        throw new Error(
          `${preflightOnly ? 'Remote schema preflight' : 'Remote smoke'} failed with status ${invocation?.Status || 'unknown'}${stderr}${details}`
        );
      }
      return remoteResult;
    };

    console.log('[two-step-smoke] Proving TEST target and live schema before creating any fixture...');
    const preflightResult = runRemote({ preflightOnly: true });
    if (!preflightResult?.evidence?.schemaSafety?.preflightComplete) {
      throw new Error('Remote schema preflight did not return complete schema evidence.');
    }
    const credentialTransport = preflightResult?.evidence?.credentialTransport;
    if (
      credentialTransport?.version !== 1 ||
      credentialTransport?.keyAlgorithm !== 'rsa-oaep-sha256' ||
      credentialTransport?.contentAlgorithm !== 'aes-256-gcm' ||
      !String(credentialTransport?.publicKeyPem || '').includes('BEGIN PUBLIC KEY')
    ) {
      throw new Error('Remote schema preflight did not establish the ephemeral credential transport key.');
    }

    if (options.schemaPreflightOnly) {
      result = preflightResult;
    } else {
      console.log('[two-step-smoke] Creating disposable TEST staff Cognito users...');
      for (const user of staffUsers) {
        createdUsers.push(user);
        user.sub = createStaffUser({ ...user, poolId }, options);
        user.session = authenticateStaffUser({ ...user, poolId, clientId }, options);
      }
      applicantUser.sub = createApplicantUser({ ...applicantUser, poolId: applicantPoolId }, options);
      remoteConfigKey = `ssm-scripts/two-step-review-smoke-${stamp}.config.enc.json`;
      uploadRemoteScript(createEncryptedFixtureEnvelope({
        staffUsers: staffUsers.map(user => ({
          key: user.key,
          email: user.email,
          password: user.password,
          sub: user.sub,
          role: user.role,
          session: user.session,
        })),
        applicantUser,
      }, credentialTransport.publicKeyPem), remoteConfigKey, options);

      console.log('[two-step-smoke] Running deployed TEST two-step review smoke through SSM...');
      result = runRemote({ preflightOnly: false });
      result.evidence = result.evidence || {};
      result.evidence.retainedDetailedArtifacts = retainedEvidenceArtifacts.map(item => ({ ...item }));
      if (!options.json) {
        console.log(summarizeResult(result));
        console.log(`[two-step-smoke] Fixture IDs: ${JSON.stringify(result.fixtureIds)}`);
      }
      const failures = (result.checks || []).filter(check => check.status === 'FAIL');
      if (failures.length) {
        throw new Error(`${failures.length} two-step review smoke check(s) failed.`);
      }
    }
  } finally {
    const cleanupErrors = [];
    const verifiedCognitoCleanup = [];
    const verifiedTemporaryObjectCleanup = [];
    if (instanceId) {
      try {
        deleteRemoteCredentialKey(instanceId, credentialKeyPath, options);
      } catch (error) { cleanupErrors.push(error); }
    }
    if (remoteConfigKey) {
      try {
        deleteRemoteScript(remoteConfigKey, options);
        verifiedTemporaryObjectCleanup.push(remoteConfigKey);
      } catch (error) { cleanupErrors.push(error); }
    }
    if (remoteKey) {
      try {
        deleteRemoteScript(remoteKey, options);
        verifiedTemporaryObjectCleanup.push(remoteKey);
      } catch (error) { cleanupErrors.push(error); }
    }
    for (const evidenceKey of Array.from(remoteEvidenceKeys).sort()) {
      try {
        deleteRemoteScript(evidenceKey, options, expectedObjectBucket);
        verifiedTemporaryObjectCleanup.push(evidenceKey);
      } catch (error) { cleanupErrors.push(error); }
    }
    if (!options.keepFixture) {
      try {
        deleteStaffUser({ email: applicantUser.email, poolId: applicantPoolId }, options);
        verifiedCognitoCleanup.push(applicantUser.email);
      } catch (error) {
        cleanupErrors.push(error);
      }
      for (const user of createdUsers.reverse()) {
        try {
          deleteStaffUser({ email: user.email, poolId }, options);
          verifiedCognitoCleanup.push(user.email);
        } catch (error) {
          cleanupErrors.push(error);
        }
      }
    }
    if (cleanupErrors.length) {
      throw new Error(`Smoke cleanup verification failed: ${cleanupErrors.map(error => error.message).join(' | ')}`);
    }
    if (result) {
      result.evidence = result.evidence || {};
      result.evidence.outerCleanup = {
        cognitoUsersVerifiedAbsent: verifiedCognitoCleanup.sort(),
        temporaryS3ObjectsAllVersionsVerifiedAbsent: verifiedTemporaryObjectCleanup.sort(),
      };
    }
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  }
}

function remoteRunner() {
  const fs = require('fs');
  const path = require('path');
  const nodeCrypto = require('crypto');
  const { createRequire } = require('module');
  const adminRequire = createRequire('/opt/nwac/admin-dashboard/package.json');
  const mysql = adminRequire('mysql2/promise');
  const puppeteer = adminRequire('puppeteer');

  try {
    adminRequire('dotenv').config({ path: '/opt/nwac/admin-dashboard/.env.test' });
    adminRequire('dotenv').config({ path: '/opt/nwac/admin-dashboard/.env' });
  } catch (_) {
    // Runtime environment is already available to PM2; dotenv is for ad hoc SSM.
  }

  const result = {
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    checks: [],
    fixtureIds: {},
    cleanup: null,
    browserIssues: [],
    evidence: {},
  };

  const schemaPreflightOnly = process.env.SCHEMA_PREFLIGHT_ONLY === '1';

  const config = {
    stamp: requiredEnv('FIXTURE_STAMP'),
    schemaPreflightOnly,
    keepFixture: process.env.KEEP_FIXTURE === '1',
    localBaseUrl: stripTrailingSlash(process.env.LOCAL_BASE_URL || 'http://127.0.0.1:5001'),
    portalLocalBaseUrl: stripTrailingSlash(process.env.PORTAL_LOCAL_BASE_URL || 'http://127.0.0.1:5000'),
    staffUsers: [],
    applicantUser: {},
    credentialKeyPath: requiredEnv('TWO_STEP_REVIEW_CREDENTIAL_KEY_PATH'),
    expectedDatabase: requiredEnv('TWO_STEP_REVIEW_EXPECTED_DB_NAME'),
    expectedDbHost: requiredEnv('TWO_STEP_REVIEW_EXPECTED_DB_HOST'),
    expectedDbUser: requiredEnv('TWO_STEP_REVIEW_EXPECTED_DB_USER'),
    expectedDbServerHostname: requiredEnv('TWO_STEP_REVIEW_EXPECTED_DB_SERVER_HOSTNAME'),
    expectedDbPort: Number(requiredEnv('TWO_STEP_REVIEW_EXPECTED_DB_PORT')),
    expectedDbPrincipal: requiredEnv('TWO_STEP_REVIEW_EXPECTED_DB_PRINCIPAL'),
    expectedObjectBucket: requiredEnv('TWO_STEP_REVIEW_EXPECTED_OBJECT_BUCKET'),
    awsAccount: requiredEnv('TWO_STEP_REVIEW_AWS_ACCOUNT'),
    awsArn: requiredEnv('TWO_STEP_REVIEW_AWS_ARN'),
    instanceId: requiredEnv('TWO_STEP_REVIEW_INSTANCE_ID'),
    expectedInstanceProfileArn: requiredEnv('TWO_STEP_REVIEW_EXPECTED_INSTANCE_PROFILE_ARN'),
    expectedInstanceRoleArn: requiredEnv('TWO_STEP_REVIEW_EXPECTED_INSTANCE_ROLE_ARN'),
    expectedInstanceRoleName: requiredEnv('TWO_STEP_REVIEW_EXPECTED_INSTANCE_ROLE_NAME'),
    expectedInstanceRoleId: requiredEnv('TWO_STEP_REVIEW_EXPECTED_INSTANCE_ROLE_ID'),
    expectedRemoteAwsAccount: requiredEnv('TWO_STEP_REVIEW_EXPECTED_REMOTE_AWS_ACCOUNT'),
    expectedRemoteAwsArn: requiredEnv('TWO_STEP_REVIEW_EXPECTED_REMOTE_AWS_ARN'),
    expectedRemoteAwsUserId: requiredEnv('TWO_STEP_REVIEW_EXPECTED_REMOTE_AWS_USER_ID'),
    evidenceBucket: requiredEnv('TWO_STEP_REVIEW_EVIDENCE_BUCKET'),
    evidenceKey: requiredEnv('TWO_STEP_REVIEW_EVIDENCE_KEY'),
    regionOverride: String(process.env.TWO_STEP_REVIEW_REGION_ID || '').trim(),
    budgetPotOverride: String(process.env.TWO_STEP_REVIEW_BUDGET_POT_ID || '').trim(),
    notificationWaitAttempts: Math.max(
      1,
      Math.min(31, Number(process.env.TWO_STEP_REVIEW_NOTIFICATION_WAIT_ATTEMPTS || 31) || 31)
    ),
    regionId: null,
    budgetPotId: null,
    financialOverviewWorkflowId: null,
  };

  const REQUIRED_TABLES = Object.freeze([
    'application_lock',
    'budget_pot',
    'budget_pot_region',
    'canada_region',
    'cfa_series',
    'cfa_version',
    'cfa_version_documents',
    'client',
    'esdc_participant_submission',
    'esdc_participant_submission_history',
    'funding_overview_series',
    'funding_overview_version',
    'funding_overview_version_documents',
    'input_json_state',
    'iset_application',
    'iset_application_assessment',
    'iset_application_draft_dynamic',
    'iset_application_submission',
    'iset_case',
    'iset_case_action_plan',
    'iset_case_conflict_declaration',
    'iset_case_intervention',
    'iset_case_note',
    'iset_case_reminder',
    'iset_reminder_lifecycle_event',
    'iset_document',
    'iset_document_intervention',
    'iset_event_delivery',
    'iset_event_entry',
    'iset_event_receipt',
    'iset_internal_notification',
    'iset_intervention_proposal',
    'iset_review_workflow',
    'iset_review_workflow_event',
    'iset_runtime_config',
    'message_attachment',
    'message_item',
    'message_signing_request',
    'messages',
    'notification_setting',
    'pending_uploads',
    'signing_request',
    'staff_profiles',
    'staff_region',
    'user',
    'user_session_audit',
    'workflow',
  ]);
  const CLEANUP_DELETE_ALLOWLIST = new Set([
    'application_lock.application_id',
    'cfa_series.id',
    'cfa_version.id',
    'cfa_version_documents.cfa_version_id',
    'cfa_version_documents.document_id',
    'client.id',
    'esdc_participant_submission.case_id',
    'esdc_participant_submission_history.participant_submission_id',
    'funding_overview_series.id',
    'funding_overview_version.id',
    'funding_overview_version_documents.document_id',
    'funding_overview_version_documents.funding_overview_version_id',
    'input_json_state.user_id',
    'iset_application.id',
    'iset_application_assessment.application_id',
    'iset_application_draft_dynamic.user_id',
    'iset_application_submission.id',
    'iset_case.id',
    'iset_case_action_plan.id',
    'iset_case_conflict_declaration.case_id',
    'iset_case_intervention.id',
    'iset_case_note.case_id',
    'iset_case_reminder.case_id',
    'iset_document.id',
    'iset_document_intervention.document_id',
    'iset_document_intervention.intervention_id',
    'iset_event_delivery.event_id',
    'iset_event_entry.actor_applicant_user_id',
    'iset_event_entry.actor_staff_profile_id',
    'iset_event_receipt.event_id',
    'iset_event_receipt.viewer_applicant_user_id',
    'iset_event_receipt.viewer_staff_profile_id',
    'iset_internal_notification.audience_applicant_user_id',
    'iset_internal_notification.audience_staff_profile_id',
    'iset_intervention_proposal.id',
    'iset_reminder_lifecycle_event.reminder_id',
    'iset_review_workflow.id',
    'iset_review_workflow_event.review_workflow_id',
    'message_attachment.message_id',
    'message_item.message_id',
    'message_signing_request.message_id',
    'message_signing_request.signing_request_id',
    'messages.id',
    'pending_uploads.user_id',
    'signing_request.id',
    'staff_profiles.id',
    'staff_region.staff_profile_id',
    'user.id',
    'user_session_audit.user_id',
  ]);
  const CLEANUP_ID_LOOKUP_ALLOWLIST = new Set([
    'cfa_series.case_id',
    'cfa_version.series_id',
    'esdc_participant_submission.case_id',
    'funding_overview_series.case_id',
    'funding_overview_version.series_id',
    'iset_case_reminder.case_id',
    'messages.case_id',
    'signing_request.case_id',
  ]);
  const CLEANUP_LIKE_ALLOWLIST = new Set([
    'iset_event_entry.payload_json',
    'iset_internal_notification.metadata',
  ]);

  const fixture = {
    suffix: config.stamp.replace(/[^a-zA-Z0-9]+/g, '').slice(-12),
    marker: { fixture: 'two-step-review-test-smoke', stamp: config.stamp },
    staff: {},
    cases: {},
    applications: {},
    submissions: {},
    actionPlans: {},
    interventions: {},
    proposals: {},
    workflows: {},
    reminders: {},
    documents: [],
    expectedObjectKeys: [],
    verifiedAbsentObjectKeys: [],
    deletedObjects: [],
    deletedObjectVersions: [],
    objectPrefixes: [],
    assessmentSentinels: {},
    reminderSentinels: {},
  };

  const smokeDates = {
    sourceStart: dateFromNow(30),
    sourceEnd: dateFromNow(60),
    proposalStart: dateFromNow(90),
    proposalEnd: dateFromNow(120),
    revisionStart: dateFromNow(150),
    revisionEnd: dateFromNow(180),
    assessmentStart: dateFromNow(90),
    assessmentEnd: dateFromNow(195),
  };

  let connection = null;
  let schemaGuard = null;
  let browser = null;
  let finalCleanupComplete = false;
  let schemaPreflightComplete = false;
  let databaseWorkStarted = false;

  main()
    .then(async () => {
      result.status = result.checks.some(check => check.status === 'FAIL') ? 'failed' : 'passed';
      result.finishedAt = new Date().toISOString();
      await emitRemoteEvidence();
      if (result.status !== 'passed') process.exitCode = 1;
    })
    .catch(async error => {
      fail('remote runner completed without crashing', {
        error: error && error.stack ? error.stack : String(error),
      });
      const schemaSafetyFailureCodes = new Set([
        'ER_BAD_FIELD_ERROR',
        'ER_COLLATION_CHARSET_MISMATCH',
        'ER_ILLEGAL_COLLATION_MIX',
        'ER_NO_SUCH_TABLE',
        'ER_PARSE_ERROR',
        'ER_SP_DOES_NOT_EXIST',
        'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD',
        'WARN_DATA_TRUNCATED',
      ]);
      const errorCode = String(error?.code || '');
      const schemaGuardFailure =
        errorCode.startsWith('schema_guard_') ||
        schemaSafetyFailureCodes.has(errorCode) ||
        String(error?.message || '').startsWith('schema_guard_');
      if (
        !schemaGuardFailure &&
        !config.keepFixture &&
        connection &&
        schemaPreflightComplete &&
        databaseWorkStarted &&
        !finalCleanupComplete
      ) {
        try {
          await cleanupFixture();
        } catch (cleanupError) {
          fail('TEST synthetic fixture cleanup after failure completed', {
            error: cleanupError && cleanupError.stack ? cleanupError.stack : String(cleanupError),
          });
        }
      } else if (schemaGuardFailure) {
        result.evidence.cleanupSafety = {
          databaseCleanupSuppressed: true,
          reason: 'schema_safety_failure',
          code: error?.code || null,
        };
      } else if (config.keepFixture) {
        result.cleanup = 'kept-after-failure';
      }
      if (browser) {
        await browser.close().catch(() => {});
        browser = null;
      }
      if (connection) {
        await connection.end().catch(() => {});
        connection = null;
      }
      if (schemaGuard) result.evidence.schemaSafety = schemaGuard.evidence();
      result.status = 'failed';
      result.finishedAt = new Date().toISOString();
      try {
        await emitRemoteEvidence();
      } catch (evidenceError) {
        console.error('remote evidence publication failed:', evidenceError?.stack || evidenceError);
      }
      process.exitCode = 1;
    });

  async function emitRemoteEvidence() {
    result.evidence = result.evidence || {};
    result.evidence.remoteDiagnostics = collectAndRemoveRemoteDiagnostics();
    const expectedEvidenceKey = `smoke-evidence/two-step-review-smoke-${config.stamp}.json`;
    if (
      config.evidenceBucket !== config.expectedObjectBucket ||
      config.evidenceKey !== expectedEvidenceKey
    ) {
      throw new Error('remote_evidence_target_unverified');
    }
    const resultPath = `/tmp/two-step-review-smoke-${config.stamp}.result.json`;
    const bytes = Buffer.from(JSON.stringify(result), 'utf8');
    const sha256 = nodeCrypto.createHash('sha256').update(bytes).digest('hex');
    fs.writeFileSync(resultPath, bytes, { mode: 0o600, flag: 'wx' });
    try {
      const { execFileSync } = require('child_process');
      execFileSync('aws', [
        's3', 'cp', resultPath, `s3://${config.evidenceBucket}/${config.evidenceKey}`,
        '--region', process.env.AWS_REGION || 'ca-central-1', '--only-show-errors', '--sse', 'AES256',
      ], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 1024 * 1024,
        timeout: 60_000,
      });
    } finally {
      fs.rmSync(resultPath, { force: true });
    }
    const compactPointer = {
      transportVersion: 1,
      status: result.status,
      finishedAt: result.finishedAt,
      checkCounts: result.checks.reduce((counts, check) => {
        const key = check.status === 'PASS' ? 'passed' : 'failed';
        counts[key] += 1;
        return counts;
      }, { passed: 0, failed: 0 }),
      artifact: {
        bucket: config.evidenceBucket,
        key: config.evidenceKey,
        sha256,
        bytes: bytes.length,
      },
    };
    console.log('@@TWO_STEP_REVIEW_SMOKE_EVIDENCE@@' + JSON.stringify(compactPointer));
  }

  function collectAndRemoveRemoteDiagnostics() {
    const exactStamp = config.stamp;
    if (!/^two-step-[A-Za-z0-9-]+(?:-preflight)?$/.test(exactStamp)) {
      throw new Error('remote_diagnostic_stamp_invalid');
    }
    const names = fs.readdirSync('/tmp').filter(name => (
      name === `two-step-review-smoke-${exactStamp}.progress.log` ||
      (name.startsWith(`two-step-review-login-failure-${exactStamp}-`) && name.endsWith('.png')) ||
      (name.startsWith(`two-step-review-route-failure-${exactStamp}-`) && name.endsWith('.png')) ||
      (name.startsWith('two-step-review-') && name.endsWith(`-${exactStamp}.png`))
    ));
    const MAX_DIAGNOSTIC_BYTES = 8 * 1024 * 1024;
    const MAX_TOTAL_DIAGNOSTIC_BYTES = 24 * 1024 * 1024;
    let totalBytes = 0;
    const collected = [];
    for (const name of names.sort()) {
      const filePath = path.join('/tmp', name);
      const stat = fs.lstatSync(filePath);
      if (!stat.isFile() || stat.size > MAX_DIAGNOSTIC_BYTES) {
        throw new Error(`remote_diagnostic_file_unbounded:${name}:${stat.size}`);
      }
      totalBytes += stat.size;
      if (totalBytes > MAX_TOTAL_DIAGNOSTIC_BYTES) {
        throw new Error(`remote_diagnostic_total_unbounded:${totalBytes}`);
      }
      const content = fs.readFileSync(filePath);
      collected.push({
        name,
        bytes: content.length,
        sha256: nodeCrypto.createHash('sha256').update(content).digest('hex'),
        encoding: name.endsWith('.log') ? 'utf8' : 'base64',
        content: name.endsWith('.log') ? content.toString('utf8') : content.toString('base64'),
      });
      fs.rmSync(filePath, { force: true });
    }
    const remaining = fs.readdirSync('/tmp').filter(name => (
      name === `two-step-review-smoke-${exactStamp}.progress.log` ||
      (name.includes(exactStamp) && /^two-step-review-.*\.(?:log|png)$/.test(name))
    ));
    if (remaining.length) {
      throw new Error(`remote_diagnostic_cleanup_incomplete:${remaining.join(',')}`);
    }
    return { exactStamp, files: collected, residueCount: 0 };
  }

  async function main() {
    progress('remote runner starting');
    const remoteAwsIdentity = verifyRemoteAwsIdentity();
    connection = await mysql.createConnection(dbConfig());
    progress('db connected');
    schemaGuard = createLiveSchemaGuard({
      connection,
      expectedDatabase: config.expectedDatabase,
      expectedHost: config.expectedDbHost,
      expectedUser: config.expectedDbUser,
      expectedDatabaseHostname: config.expectedDbServerHostname,
      expectedPort: config.expectedDbPort,
      expectedPrincipal: config.expectedDbPrincipal,
      configuredDatabase: requiredEnv('DB_NAME'),
      configuredHost: requiredEnv('DB_HOST'),
      configuredUser: requiredEnv('DB_USER'),
      configuredPort: Number(process.env.DB_PORT || 3306),
      requiredTables: REQUIRED_TABLES,
      cryptoModule: require('crypto'),
    });
    result.evidence.awsTarget = {
      account: config.awsAccount,
      arn: config.awsArn,
      instanceId: config.instanceId,
      independentlyVerifiedRemoteIdentity: remoteAwsIdentity,
    };
    result.evidence.schemaSafety = await schemaGuard.preflight();
    schemaPreflightComplete = true;
    pass('TEST DB identity and live schema preflight proved', {
      identity: result.evidence.schemaSafety.identity,
      ddlHashes: result.evidence.schemaSafety.ddlHashes,
    });
    if (String(process.env.OBJECT_BUCKET || '').trim() !== config.expectedObjectBucket) {
      throw new Error(
        `object_bucket_identity_mismatch:${String(process.env.OBJECT_BUCKET || '').trim() || 'missing'}`
      );
    }
    if (config.schemaPreflightOnly) {
      result.evidence.credentialTransport = provisionCredentialTransportKey();
      await connection.end();
      connection = null;
      progress('schema-only preflight complete');
      return;
    }
    const fixtureCredentials = decryptFixtureCredentials();
    if (!Array.isArray(fixtureCredentials?.staffUsers) || !fixtureCredentials?.applicantUser?.email) {
      throw new Error('fixture_credentials_invalid');
    }
    config.staffUsers = fixtureCredentials.staffUsers;
    config.applicantUser = fixtureCredentials.applicantUser;
    await resolveFixtureReferences();
    databaseWorkStarted = true;
    await cleanupFixture({ quiet: true });
    await seedFixture();
    await proveFixtureObjectPrefixBaseline();
    await verifyRuntimeConfig();
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const auth = await loginAllRoles();
    await runApplicationAssessmentWorkflow(auth);
    await runDualRoleApplicationAssessmentWorkflow(auth);
    await runInterventionProposalWorkflow(auth);
    await runInterventionRevisionWorkflow(auth);
    await verifyNoKnownFixtureMismatches();
    if (!config.keepFixture) {
      await cleanupFixture();
      finalCleanupComplete = true;
    } else {
      result.cleanup = 'kept';
      progress('fixture kept');
    }
    if (browser) await browser.close();
    browser = null;
    result.evidence.schemaSafety = schemaGuard.evidence();
    await connection.end();
    progress('db connection closed');
  }

  function verifiedCredentialKeyPath() {
    const value = String(config.credentialKeyPath || '');
    if (!/^\/tmp\/two-step-review-smoke-[A-Za-z0-9-]+\.credential\.pem$/.test(value)) {
      throw new Error('credential_transport_private_key_path_invalid');
    }
    return value;
  }

  function provisionCredentialTransportKey() {
    const privateKeyPath = verifiedCredentialKeyPath();
    const { publicKey, privateKey } = nodeCrypto.generateKeyPairSync('rsa', {
      modulusLength: 3072,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    fs.writeFileSync(privateKeyPath, privateKey, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    return {
      version: 1,
      keyAlgorithm: 'rsa-oaep-sha256',
      contentAlgorithm: 'aes-256-gcm',
      publicKeyPem: publicKey,
      privateKeyFileCreated: true,
    };
  }

  function decryptFixtureCredentials() {
    const envelopePath = requiredEnv('TWO_STEP_REVIEW_CONFIG_ENVELOPE_FILE');
    const privateKeyPath = verifiedCredentialKeyPath();
    let privateKey = null;
    let contentKey = null;
    let plaintext = null;
    try {
      const envelope = JSON.parse(fs.readFileSync(envelopePath, 'utf8'));
      if (
        envelope?.version !== 1 ||
        envelope?.keyAlgorithm !== 'rsa-oaep-sha256' ||
        envelope?.contentAlgorithm !== 'aes-256-gcm'
      ) {
        throw new Error('credential_transport_envelope_invalid');
      }
      privateKey = fs.readFileSync(privateKeyPath);
      contentKey = nodeCrypto.privateDecrypt({
        key: privateKey,
        padding: nodeCrypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      }, Buffer.from(envelope.encryptedKey, 'base64'));
      const decipher = nodeCrypto.createDecipheriv(
        'aes-256-gcm',
        contentKey,
        Buffer.from(envelope.iv, 'base64')
      );
      decipher.setAuthTag(Buffer.from(envelope.authenticationTag, 'base64'));
      plaintext = Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
        decipher.final(),
      ]);
      return JSON.parse(plaintext.toString('utf8'));
    } finally {
      if (plaintext) plaintext.fill(0);
      if (contentKey) contentKey.fill(0);
      if (privateKey) privateKey.fill(0);
      fs.rmSync(envelopePath, { force: true });
      fs.rmSync(privateKeyPath, { force: true });
    }
  }

  function progress(message) {
    const line = `${new Date().toISOString()} ${message}\n`;
    try {
      fs.appendFileSync(`/tmp/two-step-review-smoke-${config.stamp}.progress.log`, line, 'utf8');
    } catch (_) {
      // Progress breadcrumbs are diagnostic only.
    }
  }

  function requiredEnv(key) {
    const value = String(process.env[key] || '').trim();
    if (!value) throw new Error(`Missing env ${key}`);
    return value;
  }

  function verifyRemoteAwsIdentity() {
    const { execFileSync } = require('child_process');
    const region = process.env.OBJECT_REGION || process.env.AWS_REGION || 'ca-central-1';
    const execAwsJson = args => {
      const output = execFileSync('aws', [...args, '--region', region, '--output', 'json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 1024 * 1024,
        timeout: 30_000,
      }).trim();
      return output ? JSON.parse(output) : {};
    };
    const identity = execAwsJson(['sts', 'get-caller-identity']);
    if (
      identity?.Account !== config.expectedRemoteAwsAccount ||
      identity?.Arn !== config.expectedRemoteAwsArn ||
      identity?.UserId !== config.expectedRemoteAwsUserId ||
      config.expectedRemoteAwsAccount !== config.awsAccount ||
      config.expectedInstanceRoleArn !== `arn:aws:iam::${config.awsAccount}:role/${config.expectedInstanceRoleName}` ||
      !String(config.expectedInstanceProfileArn).startsWith(`arn:aws:iam::${config.awsAccount}:instance-profile/`)
    ) {
      throw new Error(`remote_aws_identity_mismatch:${identity?.Arn || 'missing'}`);
    }
    const bucketLocation = execAwsJson([
      's3api', 'get-bucket-location', '--bucket', config.expectedObjectBucket,
    ]);
    const resolvedBucketRegion = bucketLocation?.LocationConstraint || 'us-east-1';
    if (resolvedBucketRegion !== region || config.expectedObjectBucket !== 'nwac-test-uploads-20251014') {
      throw new Error(`remote_object_bucket_region_mismatch:${resolvedBucketRegion}`);
    }
    return {
      account: identity.Account,
      arn: identity.Arn,
      userId: identity.UserId,
      independentlyDiscoveredExpectedIdentity: {
        account: config.expectedRemoteAwsAccount,
        arn: config.expectedRemoteAwsArn,
        userId: config.expectedRemoteAwsUserId,
      },
      expectedInstanceProfileArn: config.expectedInstanceProfileArn,
      expectedRoleArn: config.expectedInstanceRoleArn,
      bucket: config.expectedObjectBucket,
      bucketRegion: resolvedBucketRegion,
    };
  }

  function stripTrailingSlash(value) {
    return String(value || '').replace(/\/+$/, '');
  }

  function dateFromNow(days) {
    const value = new Date(Date.now() + (Number(days) * 24 * 60 * 60 * 1000));
    return value.toISOString().slice(0, 10);
  }

  function dbConfig() {
    return {
      host: requiredEnv('DB_HOST'),
      port: Number(process.env.DB_PORT || 3306),
      user: requiredEnv('DB_USER'),
      password: process.env.DB_PASS || '',
      database: requiredEnv('DB_NAME'),
      multipleStatements: false,
      connectTimeout: 10000,
    };
  }

  function addCheck(status, name, details = {}) {
    result.checks.push({ status, name, details });
  }

  function pass(name, details = {}) {
    addCheck('PASS', name, details);
  }

  function fail(name, details = {}) {
    addCheck('FAIL', name, details);
  }

  function expect(name, condition, details = {}) {
    if (condition) pass(name, details);
    else fail(name, details);
  }

  function requireInvariant(name, condition, details = {}) {
    if (condition) {
      pass(name, details);
      return;
    }
    fail(name, details);
    const error = new Error(`smoke_invariant_failed:${name}`);
    error.details = details;
    throw error;
  }

  async function query(sql, params = []) {
    if (!schemaGuard) throw new Error('schema_guard_not_initialized');
    return schemaGuard.execute(sql, params);
  }

  async function insert(sql, params = []) {
    const [res] = await query(sql, params);
    return Number(res.insertId);
  }

  function json(value) {
    return JSON.stringify(value);
  }

  function parseJsonObject(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return {};
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function markerJson(extra = {}) {
    return json({ ...fixture.marker, ...extra });
  }

  function authHeaders(auth) {
    return { Authorization: `Bearer ${auth.session.idToken}` };
  }

  async function fetchAndReadBounded(url, options = {}, limits = {}) {
    if (options.signal) throw new Error('smoke_http_external_abort_signal_not_allowed');
    const requestTimeoutMs = Number(limits.requestTimeoutMs || 45_000);
    const maxBodyBytes = Number(limits.maxBodyBytes || (2 * 1024 * 1024));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('smoke_http_timeout')), requestTimeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const chunks = [];
      let bodyBytes = 0;
      if (response.body) {
        for await (const rawChunk of response.body) {
          const chunk = Buffer.from(rawChunk);
          bodyBytes += chunk.length;
          if (bodyBytes > maxBodyBytes) {
            controller.abort(new Error('smoke_http_body_limit_exceeded'));
            throw new Error(`smoke_http_body_limit_exceeded:${maxBodyBytes}`);
          }
          chunks.push(chunk);
        }
      }
      const buffer = Buffer.concat(chunks, bodyBytes);
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        setCookieHeaders: typeof response.headers.getSetCookie === 'function'
          ? response.headers.getSetCookie()
          : String(response.headers.get('set-cookie') || '').split(/,(?=\s*[^;,=\s]+=[^;,]+)/g).filter(Boolean),
        buffer,
        text: buffer.toString('utf8'),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchJson(urlOrPath, options = {}) {
    const url = String(urlOrPath).startsWith('http')
      ? urlOrPath
      : `${config.localBaseUrl}${urlOrPath}`;
    const response = await fetchAndReadBounded(url, options);
    const text = response.text;
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (_) {
      body = { raw: text.slice(0, 500) };
    }
    if (!response.ok) {
      const errorCode = body?.error || response.statusText;
      const errorMessage = body?.message || body?.raw || null;
      const error = new Error(
        `${response.status} ${errorCode}${errorMessage ? `: ${errorMessage}` : ''}`
      );
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  }

  async function fetchExpectingFailure(urlOrPath, options = {}) {
    try {
      const body = await fetchJson(urlOrPath, options);
      return { ok: true, status: 200, body };
    } catch (error) {
      return { ok: false, status: error.status || 0, body: error.body || { error: error.message } };
    }
  }

  function buildAuthorizeUrl() {
    const rawDomain = process.env.COGNITO_DOMAIN || process.env.COGNITO_STAFF_DOMAIN;
    const domain = rawDomain.startsWith('http') ? rawDomain : `https://${rawDomain}`;
    const redirectUri = process.env.COGNITO_REDIRECT_URI || process.env.REACT_APP_COGNITO_REDIRECT_URI;
    const params = new URLSearchParams({
      client_id: process.env.COGNITO_CLIENT_ID || process.env.COGNITO_STAFF_CLIENT_ID || process.env.REACT_APP_COGNITO_CLIENT_ID,
      response_type: 'code',
      scope: 'email openid profile',
      redirect_uri: redirectUri,
      state: Buffer.from(`${config.localBaseUrl}/`).toString('base64'),
    });
    return `${domain.replace(/\/+$/, '')}/oauth2/authorize?${params.toString()}`;
  }

  async function loginViaHostedUi(user) {
    const context = typeof browser.createBrowserContext === 'function'
      ? await browser.createBrowserContext()
      : (typeof browser.createIncognitoBrowserContext === 'function'
        ? await browser.createIncognitoBrowserContext()
        : null);
    const page = context ? await context.newPage() : await browser.newPage();
    page.setDefaultTimeout(60_000);
    try {
      await page.goto(buildAuthorizeUrl(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
      const usernameSelectorList = [
        'input[name="username"]',
        'input[name="email"]',
        'input[id="username"]',
        'input[id="signInFormUsername"]',
        'input[type="email"]',
        'input[type="text"]',
      ].join(', ');
      const passwordSelector = [
        'input[name="password"]',
        'input[id="password"]',
        'input[id="signInFormPassword"]',
        'input[type="password"]',
      ].join(', ');
      await page.waitForSelector(usernameSelectorList, { timeout: 60_000 });
      const usernameHandle = await page.evaluateHandle(selectorList => {
        const visible = element => {
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        };
        return Array.from(document.querySelectorAll(selectorList))
          .find(input => visible(input) && input.type !== 'password') || null;
      }, usernameSelectorList);
      const usernameElement = usernameHandle.asElement();
      if (!usernameElement) throw new Error('Hosted UI username field was not visible.');
      await usernameElement.click({ clickCount: 3 });
      await usernameElement.type(user.email);
      await page.click(passwordSelector, { clickCount: 3 });
      await page.type(passwordSelector, user.password);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => null),
        page.keyboard.press('Enter'),
      ]);
      await page.waitForFunction(() => {
        const raw = window.sessionStorage?.getItem('authSession');
        if (!raw) return false;
        try {
          const parsed = JSON.parse(raw);
          return Boolean(parsed?.idToken && parsed?.accessToken);
        } catch (_) {
          return false;
        }
      }, { timeout: 60_000 });
      const session = await page.evaluate(() => JSON.parse(window.sessionStorage.getItem('authSession')));
      const me = await fetchJson('/api/auth/me', {
        headers: authHeaders({ session }),
      });
      return {
        key: user.key,
        email: user.email,
        expectedRole: user.role,
        session,
        role: me?.auth?.role || me?.profile?.primary_role || me?.profile?.role || null,
        staffProfileId: Number(me?.auth?.staffProfileId || me?.profile?.id || 0) || null,
        me,
      };
    } catch (error) {
      const safeName = String(user.email || 'login').replace(/[^a-z0-9_.-]+/gi, '_');
      const screenshot = `/tmp/two-step-review-login-failure-${config.stamp}-${safeName}.png`;
      await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
      const url = page.url();
      const text = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '').catch(() => '');
      error.message = `${error.message} (url=${url}, screenshot=${screenshot}, pageText=${JSON.stringify(text.slice(0, 240))})`;
      throw error;
    } finally {
      await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
    }
  }

  async function loginAllRoles() {
    const auth = {};
    for (const user of config.staffUsers) {
      auth[user.key] = user.session
        ? await loginWithExistingSession(user)
        : await loginViaHostedUi(user);
      expect(`TEST Cognito login resolved ${user.role}`, auth[user.key].role === user.role, {
        email: user.email,
        resolvedRole: auth[user.key].role,
        staffProfileId: auth[user.key].staffProfileId,
      });
    }
    return auth;
  }

  async function loginWithExistingSession(user) {
    const me = await fetchJson('/api/auth/me', {
      headers: authHeaders({ session: user.session }),
    });
    return {
      key: user.key,
      email: user.email,
      expectedRole: user.role,
      session: user.session,
      role: me?.auth?.role || me?.profile?.primary_role || me?.profile?.role || null,
      staffProfileId: Number(me?.auth?.staffProfileId || me?.profile?.id || 0) || null,
      me,
    };
  }

  async function authedPage(auth) {
    const page = await browser.newPage();
    page.setDefaultTimeout(60_000);
    await page.setViewport({ width: 1360, height: 940, deviceScaleFactor: 1 });
    page.on('pageerror', error => {
      result.browserIssues.push({ type: 'pageerror', message: error.message });
    });
    page.on('console', message => {
      const text = message.text();
      if (/ReferenceError|TypeError|Unhandled|Cannot update a component/i.test(text)) {
        result.browserIssues.push({ type: 'console', level: message.type(), text: text.slice(0, 700) });
      }
    });
    page.on('response', response => {
      if (response.url().startsWith(config.localBaseUrl) && response.status() >= 500) {
        result.browserIssues.push({ type: 'api', status: response.status(), url: response.url() });
      }
    });
    await page.evaluateOnNewDocument((session, apiBase) => {
      window.__API_BASE__ = apiBase;
      sessionStorage.setItem('authSession', JSON.stringify(session));
      sessionStorage.removeItem('iset.tutorial.resetApplicationLayout');
      localStorage.setItem('application-assessment-dashboard-layout.v2', JSON.stringify([
        { id: 'coordinator-assessment', rowSpan: 10, columnSpan: 4 },
      ]));
    }, auth.session, config.localBaseUrl);
    return page;
  }

  async function assertRouteText(auth, routePath, expectedTexts, label) {
    const page = await authedPage(auth);
    try {
      await page.goto(`${config.localBaseUrl}${routePath}`, { waitUntil: 'domcontentloaded' });
      await dismissTutorialPromptIfPresent(page);
      try {
        const found = await page.waitForFunction(candidates => {
          const body = document.body?.innerText || '';
          return candidates.find(text => body.includes(text)) || false;
        }, { timeout: 60_000 }, expectedTexts).then(handle => handle.jsonValue());
        pass(`browser route: ${label}`, { routePath, found });
      } catch (error) {
        const screenshot = `/tmp/two-step-review-route-failure-${config.stamp}-${String(label).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
        await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
        const pageText = await page.evaluate(() => document.body?.innerText?.slice(0, 1200) || '').catch(() => '');
        fail(`browser route: ${label}`, {
          routePath,
          url: page.url(),
          expectedTexts,
          pageText,
          screenshot,
          error: error.message || String(error),
        });
      }
    } finally {
      await page.close().catch(() => {});
    }
  }

  async function dismissTutorialPromptIfPresent(page) {
    let tutorialSeen = false;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const clicked = await page.evaluate(() => {
        const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
        const visible = element => {
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        };
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]')).filter(visible);
        const skip = buttons.find(button => normalize(button.innerText || button.textContent || button.getAttribute('aria-label') || '') === 'Skip');
        if (!skip) return false;
        skip.click();
        return true;
      });
      if (clicked) {
        tutorialSeen = true;
        await delay(300);
        continue;
      }
      const workspaceVisible = await page.evaluate(() => (
        (document.body?.innerText || '').includes('ISET Application Assessment')
      ));
      if (tutorialSeen || (workspaceVisible && attempt >= 12)) return;
      await delay(250);
    }
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function addBrowserFailureDiagnostics(page, label, error) {
    const safeLabel = String(label).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const screenshot = `/tmp/two-step-review-${safeLabel}-${config.stamp}.png`;
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
    const pageText = await page.evaluate(() => document.body?.innerText?.slice(0, 1200) || '').catch(() => '');
    error.message = `${error.message} (url=${page.url()}, screenshot=${screenshot}, pageText=${JSON.stringify(pageText.slice(0, 500))})`;
  }

  async function waitForBodyText(page, text, timeout = 60_000) {
    await page.waitForFunction(
      expected => (document.body?.innerText || '').includes(expected),
      { timeout },
      text
    );
  }

  async function clickVisibleButton(page, label) {
    await page.waitForFunction(expected => {
      const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
      const visible = element => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      return Array.from(document.querySelectorAll('button, [role="button"]')).some(button => (
        visible(button) &&
        !button.disabled &&
        button.getAttribute('aria-disabled') !== 'true' &&
        normalize(button.innerText || button.textContent || button.getAttribute('aria-label')) === expected
      ));
    }, { timeout: 60_000 }, label);
    const clicked = await page.evaluate(expected => {
      const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
      const visible = element => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const button = Array.from(document.querySelectorAll('button, [role="button"]')).find(candidate => (
        visible(candidate) &&
        !candidate.disabled &&
        candidate.getAttribute('aria-disabled') !== 'true' &&
        normalize(candidate.innerText || candidate.textContent || candidate.getAttribute('aria-label')) === expected
      ));
      if (!button) return false;
      button.click();
      return true;
    }, label);
    if (!clicked) throw new Error(`Visible enabled button not found: ${label}`);
  }

  async function clickRadioByLabel(page, label) {
    const clicked = await page.evaluate(targetText => {
      const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
      const visible = element => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const radios = Array.from(document.querySelectorAll('[role="radio"], input[type="radio"]')).filter(visible);
      for (const radio of radios) {
        let node = radio;
        for (let depth = 0; depth < 8 && node; depth += 1) {
          if (normalize(node.innerText || node.textContent || '').includes(targetText)) {
            radio.scrollIntoView({ block: 'center', inline: 'center' });
            radio.click();
            return true;
          }
          node = node.parentElement;
        }
      }
      return false;
    }, label);
    if (!clicked) throw new Error(`Visible radio option not found: ${label}`);
  }

  async function ensureNoConflictDeclarationThroughBrowser(page, caseId, applicationId) {
    const gate = await page.waitForFunction(() => {
      const body = document.body?.innerText || '';
      if (body.includes('Decision Maker requested changes')) return 'decision';
      if (body.includes('Conflict of Interest Declaration')) return 'conflict';
      return false;
    }, { timeout: 60_000 }).then(handle => handle.jsonValue());
    if (gate === 'decision') return;

    await clickRadioByLabel(page, 'I do not have any actual, potential, or perceived conflict of interest');
    const responsePromise = page.waitForResponse(response => {
      try {
        return response.request().method() === 'PUT' && new URL(response.url()).pathname === `/api/cases/${caseId}`;
      } catch (_) {
        return false;
      }
    }, { timeout: 60_000 });
    await clickVisibleButton(page, 'Sign and Continue');
    const response = await responsePromise;
    const requestBody = JSON.parse(response.request().postData() || '{}');
    const responseText = await response.text().catch(() => '');
    if (!response.ok()) {
      throw new Error(`Conflict declaration returned ${response.status()}: ${responseText.slice(0, 500)}`);
    }
    expect('application assessment: synthetic RM satisfied the per-file conflict declaration prerequisite', (
      Number(requestBody.applicationId) === Number(applicationId) &&
      requestBody.assessment_conflict_declaration_signed === true &&
      requestBody.assessment_conflict_declaration_choice === 'no_conflict'
    ), { caseId, applicationId, requestBody, status: response.status() });
    await waitForBodyText(page, 'Decision Maker requested changes');
  }

  async function fillFirstVisibleTextarea(page, value) {
    const updated = await page.evaluate(nextValue => {
      const visible = element => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const textarea = Array.from(document.querySelectorAll('textarea')).find(element => (
        visible(element) && !element.disabled && !element.readOnly
      ));
      if (!textarea) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(textarea, nextValue);
      else textarea.value = nextValue;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, value);
    if (!updated) throw new Error('No visible editable textarea was available.');
  }

  async function clickForwardChangesThroughBrowser(auth, caseId, applicationId, options = {}) {
    const performAction = options.performAction !== false;
    const page = await authedPage(auth);
    const routePath = `/application-case/${caseId}?applicationId=${applicationId}&entry=approval&approvalType=application&step=decision`;
    try {
      await page.goto(`${config.localBaseUrl}${routePath}`, { waitUntil: 'domcontentloaded' });
      await dismissTutorialPromptIfPresent(page);
      await ensureNoConflictDeclarationThroughBrowser(page, caseId, applicationId);
      const visibleReviewActions = await page.evaluate(() => {
        const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
        const visible = element => {
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        };
        return Array.from(document.querySelectorAll('button, [role="button"]'))
          .filter(visible)
          .map(button => normalize(button.innerText || button.textContent || button.getAttribute('aria-label')))
          .filter(Boolean);
      });
      requireInvariant('application assessment: returned-to-RM UI exposes forwarding but no final-decision escalation', (
        visibleReviewActions.includes('Forward changes to Coordinator') &&
        !visibleReviewActions.includes('Submit for final decision') &&
        !visibleReviewActions.includes('Return to Coordinator')
      ), { routePath, visibleReviewActions });
      if (!performAction) {
        pass('application assessment: returned-to-RM deployed UI guard is present before concurrent writers', {
          routePath,
          visibleReviewActions,
        });
        return;
      }
      await fillFirstVisibleTextarea(page, 'Please make the requested Financial Overview correction.');
      const responsePromise = page.waitForResponse(response => (
        response.request().method() === 'POST' &&
        response.url() === `${config.localBaseUrl}/api/cases/${caseId}/assessment/review-workflow/action`
      ), { timeout: 60_000 });
      await clickVisibleButton(page, 'Forward changes to Coordinator');
      const response = await responsePromise;
      const requestBody = JSON.parse(response.request().postData() || '{}');
      const responseText = await response.text().catch(() => '');
      if (!response.ok()) {
        throw new Error(`Forward changes returned ${response.status()}: ${responseText.slice(0, 500)}`);
      }
      expect('application assessment: deployed RM UI forwards the exact returned application', (
        Number(requestBody.applicationId) === Number(applicationId) &&
        requestBody.action === 'rm_forward_changes_to_submitter'
      ), { routePath, requestBody, status: response.status() });
      await waitForBodyText(page, 'Requested changes forwarded to the Coordinator.');
    } catch (error) {
      await addBrowserFailureDiagnostics(page, 'forward-changes', error);
      throw error;
    } finally {
      await page.close().catch(() => {});
    }
  }

  async function assertReturnedToRmPolicyDenials(auth, caseId, applicationId) {
    const stateBefore = await getApplicationState(applicationId);
    const assessmentBefore = await getApplicationAssessmentBodyState(applicationId);
    const lockedEdit = await fetchExpectingFailure(`/api/cases/${caseId}`, {
      method: 'PUT',
      headers: { ...authHeaders(auth), 'Content-Type': 'application/json' },
      body: json({
        applicationId,
        case_summary: `FORGED-RETURNED-TO-RM-EDIT-${config.stamp}`,
      }),
    });
    requireInvariant('application assessment: returned-to-RM packet body edit is denied by deployed policy', (
      lockedEdit.status === 409 &&
      lockedEdit.body?.error === 'assessment_submission_locked'
    ), lockedEdit);

    const forgedEscalation = await fetchExpectingFailure(
      `/api/cases/${caseId}/assessment/review-workflow/action`,
      {
        method: 'POST',
        headers: { ...authHeaders(auth), 'Content-Type': 'application/json' },
        body: json({
          applicationId,
          action: 'rm_submit_to_nwac',
          note: 'This forged escalation must not bypass the return path.',
        }),
      }
    );
    requireInvariant('application assessment: returned-to-RM forged escalation is denied by deployed policy', (
      forgedEscalation.status === 403 &&
      forgedEscalation.body?.error === 'review_workflow_transition_forbidden'
    ), forgedEscalation);

    const stateAfter = await getApplicationState(applicationId);
    const assessmentAfter = await getApplicationAssessmentBodyState(applicationId);
    requireInvariant('application assessment: returned-to-RM denials leave workflow and assessment unchanged', (
      json(stateAfter) === json(stateBefore) &&
      json(assessmentAfter) === json(assessmentBefore)
    ), { stateBefore, stateAfter, assessmentBefore, assessmentAfter });
  }

  async function assertReturnedAssessmentEditableAndSave(auth, caseId, applicationId) {
    const page = await authedPage(auth);
    const routePath = `/application-case/${caseId}?applicationId=${applicationId}`;
    try {
      await page.goto(`${config.localBaseUrl}${routePath}`, { waitUntil: 'domcontentloaded' });
      await dismissTutorialPromptIfPresent(page);
      await waitForBodyText(page, 'Assess Eligibility');
      await clickVisibleButton(page, 'Next');
      await waitForBodyText(page, 'What is being proposed?');
      await clickVisibleButton(page, 'Next');
      await waitForBodyText(page, 'Why is this intervention needed?');

      const fieldState = await page.evaluate(() => {
        const visible = element => {
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        };
        const textarea = Array.from(document.querySelectorAll('textarea')).find(visible);
        return textarea
          ? { disabled: textarea.disabled, readOnly: textarea.readOnly, value: textarea.value }
          : null;
      });
      if (!fieldState || fieldState.disabled || fieldState.readOnly) {
        throw new Error(`Returned dual-role assessment was not editable: ${JSON.stringify(fieldState)}`);
      }

      const revisedOverview = `${fieldState.value} Clarified after the Decision Maker return.`;
      await fillFirstVisibleTextarea(page, revisedOverview);
      const responsePromise = page.waitForResponse(response => (
        response.request().method() === 'PUT' &&
        response.url() === `${config.localBaseUrl}/api/cases/${caseId}`
      ), { timeout: 60_000 });
      await clickVisibleButton(page, 'Save Progress');
      const response = await responsePromise;
      const requestBody = JSON.parse(response.request().postData() || '{}');
      const responseText = await response.text().catch(() => '');
      if (!response.ok()) {
        throw new Error(`Returned assessment Save Progress returned ${response.status()}: ${responseText.slice(0, 500)}`);
      }
      expect('application assessment: dual-role RM edits and saves the exact returned application in deployed UI', (
        Number(requestBody.applicationId) === Number(applicationId) &&
        requestBody.case_summary === revisedOverview
      ), { routePath, applicationId, requestApplicationId: requestBody.applicationId, status: response.status() });
      await waitForBodyText(page, 'Assessment saved successfully');
      return revisedOverview;
    } catch (error) {
      await addBrowserFailureDiagnostics(page, 'returned-assessment-edit', error);
      throw error;
    } finally {
      await page.close().catch(() => {});
    }
  }

  async function waitForVisibleEnabledButton(page, label) {
    await page.waitForFunction(expectedLabel => {
      const normalize = value => String(value || '').trim().replace(/\s+/g, ' ');
      const visible = element => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      return Array.from(document.querySelectorAll('button, [role="button"]')).some(candidate => (
        visible(candidate) &&
        !candidate.disabled &&
        candidate.getAttribute('aria-disabled') !== 'true' &&
        normalize(candidate.innerText || candidate.textContent || candidate.getAttribute('aria-label')) === normalize(expectedLabel)
      ));
    }, { timeout: 60_000 }, label);
  }

  async function resubmitReturnedAssessmentThroughBrowser(auth, caseId, applicationId, options = {}) {
    const baseline = options.baseline || null;
    const pendingSigning = options.pendingSigning || null;
    if (
      !baseline?.application ||
      !Number.isSafeInteger(Number(baseline.application.row_version)) ||
      !Number.isSafeInteger(Number(pendingSigning?.signingRequestId)) ||
      !Number.isSafeInteger(Number(pendingSigning?.fundingOverviewVersionId)) ||
      typeof pendingSigning?.serializedPayload !== 'string' ||
      !pendingSigning.serializedPayload ||
      typeof pendingSigning?.cookieHeader !== 'string' ||
      !pendingSigning.cookieHeader
    ) {
      throw new Error('returned_assessment_resubmit_race_scope_invalid');
    }
    const page = await authedPage(auth);
    const routePath = `/application-case/${caseId}?applicationId=${applicationId}`;
    const submitUrl = `${config.localBaseUrl}/api/cases/${caseId}`;
    const signingUrl = `${config.portalLocalBaseUrl}/api/signing-requests/${pendingSigning.signingRequestId}/sign`;
    let submitInterceptCount = 0;
    let capturedRequestBody = null;
    let capturedRequestPayload = null;
    let racePromise = null;
    try {
      await page.setRequestInterception(true);
      page.on('request', async request => {
        if (request.method() !== 'PUT' || request.url() !== submitUrl) {
          request.continue().catch(() => {});
          return;
        }
        const postData = request.postData() || '';
        const parsed = parseJsonObject(postData);
        if (parsed.assessment_submit_action !== true) {
          request.continue().catch(() => {});
          return;
        }
        submitInterceptCount += 1;
        if (submitInterceptCount !== 1) {
          await request.respond({
            status: 599,
            headers: { 'content-type': 'application/json; charset=utf-8' },
            body: json({ error: 'unexpected_duplicate_browser_resubmit' }),
          }).catch(() => {});
          return;
        }
        capturedRequestBody = postData;
        capturedRequestPayload = parsed;
        racePromise = (async () => {
          const adminStartedAt = new Date().toISOString();
          const adminOperations = ['browser-copy', 'concurrent-copy'].map(async caller => {
            try {
              const response = await fetchAndReadBounded(submitUrl, {
                method: 'PUT',
                headers: {
                  ...authHeaders(auth),
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                },
                body: capturedRequestBody,
              }, {
                requestTimeoutMs: 180_000,
                maxBodyBytes: 512 * 1024,
              });
              let body = null;
              try { body = response.text ? JSON.parse(response.text) : null; } catch (_) { body = null; }
              return {
                caller,
                status: response.status,
                body,
                response,
                completedAt: new Date().toISOString(),
              };
            } catch (error) {
              return {
                caller,
                status: 0,
                body: { error: error.message || String(error) },
                response: null,
                completedAt: new Date().toISOString(),
              };
            }
          });
          const signingOperation = (async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            const startedAt = new Date().toISOString();
            try {
              const response = await fetchAndReadBounded(signingUrl, {
                method: 'POST',
                headers: {
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                  Cookie: pendingSigning.cookieHeader,
                },
                body: pendingSigning.serializedPayload,
              }, {
                requestTimeoutMs: 180_000,
                maxBodyBytes: 256 * 1024,
              });
              let body = null;
              try { body = response.text ? JSON.parse(response.text) : null; } catch (_) { body = null; }
              return { status: response.status, body, startedAt, completedAt: new Date().toISOString() };
            } catch (error) {
              return {
                status: 0,
                body: { error: error.message || String(error) },
                startedAt,
                completedAt: new Date().toISOString(),
              };
            }
          })();
          const [adminOutcomes, signingOutcome] = await Promise.all([
            Promise.all(adminOperations),
            signingOperation,
          ]);
          const successfulAdmin = adminOutcomes.find(item => item.status === 200 && item.body?.success === true) || null;
          const responseForBrowser = successfulAdmin || adminOutcomes[0];
          const beforeReplay = await captureReturnedAssessmentResubmitState(
            caseId,
            applicationId,
            baseline.application.workflow_id
          );
          const replayResponse = await fetchAndReadBounded(submitUrl, {
            method: 'PUT',
            headers: {
              ...authHeaders(auth),
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: capturedRequestBody,
          }, {
            requestTimeoutMs: 120_000,
            maxBodyBytes: 512 * 1024,
          });
          let replayBody = null;
          try { replayBody = replayResponse.text ? JSON.parse(replayResponse.text) : null; } catch (_) { replayBody = null; }
          const signingReplayResponse = await fetchAndReadBounded(signingUrl, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Cookie: pendingSigning.cookieHeader,
            },
            body: pendingSigning.serializedPayload,
          }, {
            requestTimeoutMs: 120_000,
            maxBodyBytes: 256 * 1024,
          });
          let signingReplayBody = null;
          try {
            signingReplayBody = signingReplayResponse.text
              ? JSON.parse(signingReplayResponse.text)
              : null;
          } catch (_) {
            signingReplayBody = null;
          }
          const afterReplay = await captureReturnedAssessmentResubmitState(
            caseId,
            applicationId,
            baseline.application.workflow_id
          );
          return {
            adminStartedAt,
            adminOutcomes,
            signingOutcome,
            replay: { status: replayResponse.status, body: replayBody },
            signingReplay: { status: signingReplayResponse.status, body: signingReplayBody },
            beforeReplay,
            afterReplay,
            responseForBrowser,
          };
        })();

        try {
          const race = await racePromise;
          const response = race.responseForBrowser?.response;
          await request.respond({
            status: response?.status || race.responseForBrowser?.status || 599,
            headers: { 'content-type': response?.headers?.get('content-type') || 'application/json; charset=utf-8' },
            body: response?.buffer || Buffer.from(json(race.responseForBrowser?.body || { error: 'resubmit_race_failed' })),
          });
        } catch (error) {
          await request.respond({
            status: 599,
            headers: { 'content-type': 'application/json; charset=utf-8' },
            body: json({ error: 'resubmit_race_intercept_failed', message: error.message || String(error) }),
          }).catch(() => {});
        }
      });
      await page.goto(`${config.localBaseUrl}${routePath}`, { waitUntil: 'domcontentloaded' });
      await dismissTutorialPromptIfPresent(page);
      await waitForBodyText(page, 'Assess Eligibility');
      for (let index = 0; index < 11; index += 1) {
        await waitForVisibleEnabledButton(page, 'Next');
        await clickVisibleButton(page, 'Next');
        if (index === 9) {
          await waitForBodyText(page, 'All required checklist items are complete.');
        }
      }
      await waitForVisibleEnabledButton(page, 'Resubmit for review');
      const responsePromise = page.waitForResponse(response => (
        response.request().method() === 'PUT' &&
        response.url() === submitUrl &&
        parseJsonObject(response.request().postData()).assessment_submit_action === true
      ), { timeout: 240_000 });
      await clickVisibleButton(page, 'Resubmit for review');
      const response = await responsePromise;
      const responseText = await response.text().catch(() => '');
      if (!response.ok()) {
        throw new Error(`Returned assessment resubmit returned ${response.status()}: ${responseText.slice(0, 500)}`);
      }
      const race = racePromise ? await racePromise : null;
      const successfulAdmin = (race?.adminOutcomes || []).filter(item => (
        item.status === 200 && item.body?.success === true
      ));
      const staleAdmin = (race?.adminOutcomes || []).filter(item => (
        item.status === 409 &&
        item.body?.success === false &&
        item.body?.error === 'row_version_conflict'
      ));
      requireInvariant('application assessment: deployed UI supplies the exact scoped optimistic resubmit payload', (
        submitInterceptCount === 1 &&
        Number(capturedRequestPayload?.applicationId) === Number(applicationId) &&
        capturedRequestPayload?.assessment_submit_action === true &&
        capturedRequestPayload?.applicationStatus === 'pending_approval' &&
        Number(capturedRequestPayload?.expectedRowVersion) === Number(baseline.application.row_version) &&
        !Object.prototype.hasOwnProperty.call(capturedRequestPayload, 'assessment_preserve_existing_application_form') &&
        !Object.prototype.hasOwnProperty.call(capturedRequestPayload, 'assessment_preserve_existing_financial_overview')
      ), {
        routePath,
        applicationId,
        requestApplicationId: capturedRequestPayload?.applicationId,
        expectedRowVersion: capturedRequestPayload?.expectedRowVersion,
      });
      requireInvariant('application assessment: exact concurrent resubmit copies serialize to one commit and one stale conflict', (
        successfulAdmin.length === 1 &&
        staleAdmin.length === 1 &&
        Number(staleAdmin[0]?.body?.currentRowVersion) === Number(successfulAdmin[0]?.body?.application_row_version) &&
        new Date(race?.signingOutcome?.startedAt || 0).getTime() <
          Math.min(...(race?.adminOutcomes || []).map(item => new Date(item.completedAt || 0).getTime()))
      ), {
        adminStartedAt: race?.adminStartedAt || null,
        signingStartedAt: race?.signingOutcome?.startedAt || null,
        adminOutcomes: (race?.adminOutcomes || []).map(item => ({
          caller: item.caller,
          status: item.status,
          state: item.body?.success === true ? 'committed' : item.body?.error || null,
          currentRowVersion: item.body?.currentRowVersion || item.body?.application_row_version || null,
          completedAt: item.completedAt,
        })),
      });
      requireInvariant('application assessment: applicant signing overlaps resubmit and completes without deadlock or server failure', (
        race?.signingOutcome?.status === 200 &&
        race?.signingOutcome?.body?.status === 'signed'
      ), race?.signingOutcome || {});
      requireInvariant('application assessment: exact stale resubmit replay is a side-effect-free row-version conflict', (
        race?.replay?.status === 409 &&
        race?.replay?.body?.success === false &&
        race?.replay?.body?.error === 'row_version_conflict' &&
        json(race?.afterReplay) === json(race?.beforeReplay)
      ), {
        replay: race?.replay || null,
        beforeReplay: race?.beforeReplay || null,
        afterReplay: race?.afterReplay || null,
      });
      requireInvariant('application assessment: exact signing replay is side-effect-free and returns the canonical result', (
        race?.signingReplay?.status === 200 &&
        race?.signingReplay?.body?.status === 'signed' &&
        race?.signingReplay?.body?.alreadySigned === true
      ), race?.signingReplay || {});
      const cardinality = await verifyReturnedAssessmentResubmitRaceCardinality({
        caseId,
        applicationId,
        baseline,
        after: race.afterReplay,
        pendingSigning,
      });
      await waitForBodyText(page, 'Assessment submitted to Regional Manager review.');
      result.evidence.returnedAssessmentResubmitRace = {
        caseId,
        applicationId,
        signingRequestId: pendingSigning.signingRequestId,
        fundingOverviewVersionId: pendingSigning.fundingOverviewVersionId,
        startedAt: race.adminStartedAt,
        signingStartedAt: race.signingOutcome.startedAt,
        adminOutcomes: race.adminOutcomes.map(item => ({
          caller: item.caller,
          status: item.status,
          state: item.body?.success === true ? 'committed' : item.body?.error || null,
          completedAt: item.completedAt,
        })),
        signingOutcome: {
          status: race.signingOutcome.status,
          state: race.signingOutcome.body?.status || race.signingOutcome.body?.error || null,
          completedAt: race.signingOutcome.completedAt,
        },
        resubmitReplay: {
          status: race.replay.status,
          state: race.replay.body?.error || null,
        },
        signingReplay: {
          status: race.signingReplay.status,
          state: race.signingReplay.body?.status || race.signingReplay.body?.error || null,
          alreadySigned: race.signingReplay.body?.alreadySigned === true,
        },
        cardinality,
      };
    } catch (error) {
      await addBrowserFailureDiagnostics(page, 'returned-assessment-resubmit', error);
      throw error;
    } finally {
      await page.close().catch(() => {});
    }
  }

  async function submitCorrectedAssessmentForFinalDecisionThroughBrowser(auth, caseId, applicationId) {
    const page = await authedPage(auth);
    const routePath = `/application-case/${caseId}?applicationId=${applicationId}&entry=approval&approvalType=application&step=decision`;
    try {
      await page.goto(`${config.localBaseUrl}${routePath}`, { waitUntil: 'domcontentloaded' });
      await dismissTutorialPromptIfPresent(page);
      await waitForBodyText(page, 'Regional Manager review');
      await fillFirstVisibleTextarea(page, 'Corrected Financial Overview reviewed and ready for final decision.');
      await waitForVisibleEnabledButton(page, 'Submit for final decision');
      const responsePromise = page.waitForResponse(response => (
        response.request().method() === 'POST' &&
        response.url() === `${config.localBaseUrl}/api/cases/${caseId}/assessment/review-workflow/action`
      ), { timeout: 60_000 });
      await clickVisibleButton(page, 'Submit for final decision');
      const response = await responsePromise;
      const requestBody = JSON.parse(response.request().postData() || '{}');
      const responseText = await response.text().catch(() => '');
      if (!response.ok()) {
        throw new Error(`Corrected assessment final-decision submit returned ${response.status()}: ${responseText.slice(0, 500)}`);
      }
      expect('application assessment: dual-role RM sends corrected assessment to Decision Maker through deployed UI', (
        Number(requestBody.applicationId) === Number(applicationId) &&
        requestBody.action === 'rm_submit_to_nwac'
      ), { routePath, applicationId, requestBody, status: response.status() });
      await waitForBodyText(page, 'Assessment submitted for final decision.');
    } catch (error) {
      await addBrowserFailureDiagnostics(page, 'corrected-assessment-final-submit', error);
      throw error;
    } finally {
      await page.close().catch(() => {});
    }
  }

  async function loginApplicantThroughPortal() {
    const response = await fetchAndReadBounded(`${config.portalLocalBaseUrl}/api/auth/password-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json({ email: config.applicantUser.email, password: config.applicantUser.password }),
    });
    const responseText = response.text;
    if (!response.ok) {
      throw new Error(`Participant password login returned ${response.status}: ${responseText.slice(0, 500)}`);
    }
    const setCookieHeaders = response.setCookieHeaders;
    const cookies = setCookieHeaders.map(header => {
      const [pair] = String(header).split(';');
      const equals = pair.indexOf('=');
      return {
        name: pair.slice(0, equals).trim(),
        value: pair.slice(equals + 1).trim(),
        url: config.portalLocalBaseUrl,
      };
    }).filter(cookie => cookie.name && cookie.value);
    if (!cookies.length) throw new Error('Participant password login returned no auth cookies.');
    return {
      cookies,
      cookieHeader: cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; '),
    };
  }

  async function typeIntoInput(page, selector, value) {
    await page.waitForSelector(selector, { visible: true, timeout: 60_000 });
    await page.click(selector, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type(selector, String(value));
  }

  async function interceptPortalApi(page, cookieHeader, options = {}) {
    const corsHeaders = {
      'access-control-allow-origin': config.portalLocalBaseUrl,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization,x-access-token',
    };
    await page.setRequestInterception(true);
    page.on('request', async request => {
      if (!/\/api\//.test(request.url())) {
        request.continue().catch(() => {});
        return;
      }
      if (request.method() === 'OPTIONS') {
        request.respond({ status: 204, headers: corsHeaders, body: '' }).catch(() => {});
        return;
      }
      try {
        const parsed = new URL(request.url());
        const forwardedResponse = fetchAndReadBounded(`${config.portalLocalBaseUrl}${parsed.pathname}${parsed.search}`, {
          method: request.method(),
          headers: {
            Accept: request.headers().accept || 'application/json',
            Cookie: cookieHeader,
            ...(request.headers()['content-type']
              ? { 'Content-Type': request.headers()['content-type'] }
              : {}),
          },
          body: ['GET', 'HEAD'].includes(request.method()) ? undefined : request.postData(),
          redirect: 'manual',
        });
        if (typeof options.onForwardedRequest === 'function') {
          await options.onForwardedRequest({
            method: request.method(),
            pathname: parsed.pathname,
            search: parsed.search,
            postData: request.postData(),
          });
        }
        const response = await forwardedResponse;
        await request.respond({
          status: response.status,
          headers: {
            ...corsHeaders,
            'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8',
          },
          body: response.buffer,
        });
      } catch (error) {
        await request.respond({
          status: 599,
          headers: { ...corsHeaders, 'content-type': 'application/json; charset=utf-8' },
          body: json({ error: 'intercept_failed', message: error.message || String(error) }),
        }).catch(() => {});
      }
    });
  }

  async function completeFinancialOverviewThroughPortal(signingRequestId, fundingOverviewVersionId, options = {}) {
    const { cookies, cookieHeader } = await loginApplicantThroughPortal();
    const page = await browser.newPage();
    const signingPath = `/api/signing-requests/${signingRequestId}/sign`;
    const signingUrl = `${config.portalLocalBaseUrl}${signingPath}`;
    const concurrentRmForward = options.concurrentRmForward || null;
    let signingRequestHookCount = 0;
    let serializedPayload = null;
    let concurrentStartedAt = null;
    let concurrentSigningPromise = null;
    let concurrentRmForwardPromise = null;
    page.setDefaultTimeout(60_000);
    page.on('pageerror', error => result.browserIssues.push({ type: 'pageerror', message: error.message }));
    page.on('console', message => {
      const text = message.text();
      if (/ReferenceError|TypeError|Unhandled/i.test(text)) {
        result.browserIssues.push({ type: 'console', level: message.type(), text: text.slice(0, 700) });
      }
    });
    page.on('response', response => {
      if (/\/api\//.test(response.url()) && response.status() >= 500) {
        result.browserIssues.push({ type: 'api', status: response.status(), url: response.url() });
      }
    });
    try {
      await page.setCookie(...cookies);
      await interceptPortalApi(page, cookieHeader, {
        onForwardedRequest: async request => {
          if (request.method !== 'POST' || request.pathname !== signingPath) return;
          signingRequestHookCount += 1;
          if (signingRequestHookCount !== 1) {
            throw new Error(`unexpected_browser_signing_request_count:${signingRequestHookCount}`);
          }
          const parsedPayload = parseJsonObject(request.postData);
          if (!request.postData || !Object.keys(parsedPayload).length) {
            throw new Error('browser_signing_payload_missing');
          }
          serializedPayload = request.postData;
          concurrentStartedAt = new Date().toISOString();
          concurrentSigningPromise = (async () => {
            const response = await fetchAndReadBounded(signingUrl, {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Cookie: cookieHeader,
              },
              body: serializedPayload,
            }, {
              requestTimeoutMs: 120_000,
              maxBodyBytes: 256 * 1024,
            });
            let body = null;
            try { body = response.text ? JSON.parse(response.text) : null; } catch (_) { body = null; }
            return { caller: 'concurrent', status: response.status, body };
          })().catch(error => ({ caller: 'concurrent', status: 0, body: { error: error.message || String(error) } }));

          if (concurrentRmForward) {
            const rmCaseId = Number(concurrentRmForward.caseId);
            const rmApplicationId = Number(concurrentRmForward.applicationId);
            if (
              !Number.isSafeInteger(rmCaseId) || rmCaseId <= 0 ||
              !Number.isSafeInteger(rmApplicationId) || rmApplicationId <= 0 ||
              !concurrentRmForward.auth?.session?.idToken
            ) {
              throw new Error('concurrent_rm_forward_scope_invalid');
            }
            concurrentRmForwardPromise = (async () => {
              const response = await fetchAndReadBounded(
                `${config.localBaseUrl}/api/cases/${rmCaseId}/assessment/review-workflow/action`,
                {
                  method: 'POST',
                  headers: {
                    ...authHeaders(concurrentRmForward.auth),
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                  },
                  body: json({
                    applicationId: rmApplicationId,
                    action: 'rm_forward_changes_to_submitter',
                    note: 'Forwarding Decision Maker changes while the participant signing completion is in flight.',
                  }),
                },
                { requestTimeoutMs: 120_000, maxBodyBytes: 256 * 1024 }
              );
              let body = null;
              try { body = response.text ? JSON.parse(response.text) : null; } catch (_) { body = null; }
              return { status: response.status, body };
            })().catch(error => ({ status: 0, body: { error: error.message || String(error) } }));
          }
        },
      });
      await page.goto(`${config.portalLocalBaseUrl}/documents/${signingRequestId}`, { waitUntil: 'networkidle2' });
      await waitForBodyText(page, 'Financial Overview');
      await typeIntoInput(page, '#income-employment', '1640.50');
      await typeIntoInput(page, '#income-spousal', '250.00');
      await typeIntoInput(page, '#income-social-assist', '0.00');
      await clickVisibleButton(page, 'Next');
      await typeIntoInput(page, '#expenses-rent', '925.00');
      await typeIntoInput(page, '#expenses-electricity', '185.25');
      await typeIntoInput(page, '#expenses-groceries', '465.00');
      await clickVisibleButton(page, 'Next');
      await typeIntoInput(page, '#client-sig', 'Two StepApplicant');
      await clickVisibleButton(page, 'Sign Now');

      const [versionContractRows] = await query(
        `SELECT id, status, snapshot_schema_version
           FROM funding_overview_version
          WHERE id = ?`,
        [fundingOverviewVersionId]
      );
      const versionContract = versionContractRows[0] || null;
      requireInvariant('application assessment: normal signing starts from the exact sent Financial Overview version', (
        versionContractRows.length === 1 &&
        Number(versionContract?.id) === Number(fundingOverviewVersionId) &&
        versionContract?.status === 'sent' &&
        typeof versionContract?.snapshot_schema_version === 'string' &&
        versionContract.snapshot_schema_version.length > 0
      ), { signingRequestId, fundingOverviewVersionId, versionContractRows });
      const [documentsBeforeSigning] = await query(
        `SELECT id, file_path
           FROM iset_document
          WHERE signing_request_id = ?
          ORDER BY id`,
        [signingRequestId]
      );
      const objectInventoryBeforeSigning = listFixturePrefixInventory();
      requireInvariant('application assessment: normal signing concurrency begins without artifact residue', (
        documentsBeforeSigning.length === 0
      ), { signingRequestId, documentsBeforeSigning });

      const browserResponsePromise = page.waitForResponse(response => (
        response.request().method() === 'POST' &&
        response.url().endsWith(signingPath)
      ), { timeout: 120_000 });
      await clickVisibleButton(page, 'Submit');
      const browserResponse = await browserResponsePromise;
      const browserResponseText = await browserResponse.text().catch(() => '');
      let browserResponseBody = null;
      try { browserResponseBody = browserResponseText ? JSON.parse(browserResponseText) : null; } catch (_) { browserResponseBody = null; }
      const browserSigningOutcome = {
        caller: 'browser',
        status: browserResponse.status(),
        body: browserResponseBody,
      };
      const concurrentSigningOutcome = concurrentSigningPromise
        ? await concurrentSigningPromise
        : { caller: 'concurrent', status: 0, body: { error: 'concurrent_signing_not_started' } };
      const concurrentRmForwardResponse = concurrentRmForwardPromise
        ? await concurrentRmForwardPromise
        : null;
      const concurrentResponses = [browserSigningOutcome, concurrentSigningOutcome];
      const signingSucceeded = item => item.status === 200 && item.body?.status === 'signed';
      const signingRetryable = item => (
        item.status === 409 &&
        item.body?.retryable === true &&
        ['signing_in_progress', 'signing_retry_required'].includes(item.body?.error)
      );
      requireInvariant('application assessment: true concurrent normal portal signing calls converge without a server failure', (
        signingRequestHookCount === 1 &&
        typeof serializedPayload === 'string' &&
        serializedPayload.length > 0 &&
        concurrentResponses.some(signingSucceeded) &&
        concurrentResponses.every(item => signingSucceeded(item) || signingRetryable(item))
      ), { signingRequestId, concurrentStartedAt, concurrentResponses });
      if (concurrentRmForward) {
        const returnedWorkflow =
          concurrentRmForwardResponse?.body?.reviewWorkflow ||
          concurrentRmForwardResponse?.body?.review_workflow ||
          null;
        requireInvariant('application assessment: concurrent applicant signing and RM forward serialize to returned-to-submitter', (
          concurrentRmForwardResponse?.status === 200 &&
          Number(concurrentRmForwardResponse?.body?.applicationId) === Number(concurrentRmForward.applicationId) &&
          returnedWorkflow?.current_stage === 'returned_to_submitter'
        ), {
          caseId: concurrentRmForward.caseId,
          applicationId: concurrentRmForward.applicationId,
          status: concurrentRmForwardResponse?.status || null,
          reviewStage: returnedWorkflow?.current_stage || null,
        });
      }

      const replay = await fetchAndReadBounded(signingUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Cookie: cookieHeader,
        },
        body: serializedPayload,
      }, {
        requestTimeoutMs: 120_000,
        maxBodyBytes: 256 * 1024,
      });
      let replayBody = null;
      try { replayBody = replay.text ? JSON.parse(replay.text) : null; } catch (_) { replayBody = null; }
      requireInvariant('application assessment: exact normal signing replay returns the canonical signed result', (
        replay.status === 200 &&
        replayBody?.status === 'signed' &&
        replayBody?.alreadySigned === true
      ), { signingRequestId, status: replay.status, body: replayBody });

      const [convergedSigningRows] = await query(
        `SELECT id, status, completion_artifact_key, completion_event_id,
                completion_claim_token, completion_claim_expires_at
           FROM signing_request
          WHERE id = ?`,
        [signingRequestId]
      );
      const convergedSigningRow = convergedSigningRows[0] || null;
      const [convergedDocumentRows] = await query(
        `SELECT id, file_path
           FROM iset_document
          WHERE signing_request_id = ?
          ORDER BY id`,
        [signingRequestId]
      );
      const [convergedVersionLinkRows] = await query(
        `SELECT funding_overview_version_id, document_type, document_id
           FROM funding_overview_version_documents
          WHERE funding_overview_version_id = ?
            AND document_type = 'signed'
          ORDER BY document_id`,
        [fundingOverviewVersionId]
      );
      const [convergedEventRows] = await query(
        `SELECT id, event_type
           FROM iset_event_entry
          WHERE id = ?`,
        [convergedSigningRow?.completion_event_id]
      );
      const [convergedVersionRows] = await query(
        `SELECT id, status, signed_at, signed_by_participant_id
           FROM funding_overview_version
          WHERE id = ?`,
        [fundingOverviewVersionId]
      );
      const canonicalObjectKey = String(convergedSigningRow?.completion_artifact_key || '').trim();
      if (canonicalObjectKey) fixture.expectedObjectKeys.push(canonicalObjectKey);
      const convergedObjectInventory = listFixturePrefixInventory();
      const convergedCurrentObjects = convergedObjectInventory.currentObjects.filter(item => item.key === canonicalObjectKey);
      const convergedObjectVersions = convergedObjectInventory.versions.filter(item => (
        item.key === canonicalObjectKey && item.kind === 'version'
      ));
      const addedCurrentObjects = objectEntriesAdded(
        objectInventoryBeforeSigning.currentObjects,
        convergedObjectInventory.currentObjects
      );
      const addedObjectVersions = objectEntriesAdded(
        objectInventoryBeforeSigning.versions,
        convergedObjectInventory.versions
      );
      requireInvariant('application assessment: normal success/concurrency/replay produces one canonical signed artifact', (
        convergedSigningRows.length === 1 &&
        convergedSigningRow?.status === 'signed' &&
        canonicalObjectKey.length > 0 &&
        convergedSigningRow?.completion_claim_token == null &&
        convergedSigningRow?.completion_claim_expires_at == null &&
        convergedDocumentRows.length === 1 &&
        convergedDocumentRows[0]?.file_path === canonicalObjectKey &&
        convergedVersionLinkRows.length === 1 &&
        Number(convergedVersionLinkRows[0]?.funding_overview_version_id) === Number(fundingOverviewVersionId) &&
        convergedVersionLinkRows[0]?.document_type === 'signed' &&
        Number(convergedVersionLinkRows[0]?.document_id) === Number(convergedDocumentRows[0]?.id) &&
        convergedEventRows.length === 1 &&
        convergedEventRows[0]?.event_type === 'document_signed' &&
        convergedVersionRows.length === 1 &&
        convergedVersionRows[0]?.status === 'signed' &&
        convergedVersionRows[0]?.signed_at != null &&
        Number(convergedVersionRows[0]?.signed_by_participant_id) === Number(fixture.applicantUser) &&
        convergedCurrentObjects.length === 1 &&
        convergedObjectVersions.length === 1 &&
        addedCurrentObjects.length === 1 &&
        addedCurrentObjects[0]?.key === canonicalObjectKey &&
        addedObjectVersions.length === 1 &&
        addedObjectVersions[0]?.key === canonicalObjectKey &&
        addedObjectVersions[0]?.kind === 'version'
      ), {
        signingRequestId,
        fundingOverviewVersionId,
        documentIds: convergedDocumentRows.map(row => row.id),
        versionLinks: convergedVersionLinkRows,
        eventIds: convergedEventRows.map(row => row.id),
        currentObjectCount: convergedCurrentObjects.length,
        objectVersionCount: convergedObjectVersions.length,
        addedCurrentObjects,
        addedObjectVersions,
      });

      await page.reload({ waitUntil: 'networkidle2', timeout: 60_000 });
      await waitForBodyText(page, 'Submitted');
      const signedRequest = await fetchAndReadBounded(
        `${config.portalLocalBaseUrl}/api/signing-requests/${signingRequestId}`,
        { headers: { Accept: 'application/json', Cookie: cookieHeader } },
        { requestTimeoutMs: 45_000, maxBodyBytes: 256 * 1024 }
      );
      let signedRequestBody = null;
      try { signedRequestBody = signedRequest.text ? JSON.parse(signedRequest.text) : null; } catch (_) { signedRequestBody = null; }
      requireInvariant('application assessment: participant sees the converged Financial Overview as submitted in deployed portal', (
        signedRequest.status === 200 && signedRequestBody?.status === 'signed'
      ), { signingRequestId, status: signedRequest.status, body: signedRequestBody });
      result.evidence.signingSuccessReplayConcurrency = {
        signingRequestId,
        fundingOverviewVersionId,
        concurrentStartedAt,
        concurrentOutcomes: concurrentResponses.map(item => ({
          caller: item.caller,
          status: item.status,
          state: item.body?.status || item.body?.error || null,
          alreadySigned: item.body?.alreadySigned === true,
          retryable: item.body?.retryable === true,
        })),
        concurrentRmForwardOutcome: concurrentRmForwardResponse ? {
          status: concurrentRmForwardResponse.status,
          applicationId: Number(concurrentRmForwardResponse.body?.applicationId) || null,
          reviewStage: (
            concurrentRmForwardResponse.body?.reviewWorkflow?.current_stage ||
            concurrentRmForwardResponse.body?.review_workflow?.current_stage ||
            null
          ),
        } : null,
        replayOutcome: {
          status: replay.status,
          state: replayBody?.status || replayBody?.error || null,
          alreadySigned: replayBody?.alreadySigned === true,
        },
        canonicalObjectKeySha256: nodeCrypto.createHash('sha256').update(canonicalObjectKey).digest('hex'),
        canonicalDocumentId: Number(convergedDocumentRows[0]?.id) || null,
        canonicalEventId: convergedSigningRow?.completion_event_id || null,
      };
      return {
        signingRequestId: Number(signingRequestId),
        fundingOverviewVersionId: Number(fundingOverviewVersionId),
        serializedPayload,
        cookieHeader,
      };
    } catch (error) {
      await addBrowserFailureDiagnostics(page, 'financial-overview-signing', error);
      throw error;
    } finally {
      await page.close().catch(() => {});
    }
  }

  async function getReminderRows(reminderIds) {
    if (!Array.isArray(reminderIds) || reminderIds.length === 0) return [];
    const placeholders = reminderIds.map(() => '?').join(',');
    const [rows] = await query(
      `SELECT id, application_id, status, due_at, metadata_json, updated_at, deleted_at
         FROM iset_case_reminder
        WHERE id IN (${placeholders})
        ORDER BY id`,
      reminderIds
    );
    return rows || [];
  }

  function reminderFingerprint(rows) {
    return (rows || []).map(row => ({
      id: Number(row.id),
      applicationId: Number(row.application_id),
      status: row.status || null,
      dueAt: row.due_at ? new Date(row.due_at).toISOString() : null,
      metadata: typeof row.metadata_json === 'string'
        ? JSON.parse(row.metadata_json)
        : (row.metadata_json || null),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
    }));
  }

  async function resolveFixtureReferences() {
    const regionOverride = config.regionOverride
      ? Number(config.regionOverride)
      : null;
    if (config.regionOverride && (!Number.isSafeInteger(regionOverride) || regionOverride < 1)) {
      throw new Error('invalid_TWO_STEP_REVIEW_REGION_ID');
    }
    const regionParams = regionOverride ? [regionOverride] : [];
    const [regionRows] = await query(
      `SELECT region_id, code
         FROM canada_region
        ${regionOverride ? 'WHERE region_id = ?' : ''}
        ORDER BY region_id ASC`,
      regionParams
    );
    if (regionOverride && regionRows.length !== 1) {
      throw new Error(`TEST region override ${regionOverride} was not found exactly once.`);
    }
    if (!regionRows.length) throw new Error('TEST has no verified canada_region row for the fixture.');
    const regionCandidates = regionRows.map(row => ({
      regionId: Number(row.region_id),
      regionCode: String(row.code || '').trim(),
    }));
    if (regionCandidates.some(candidate => (
      !Number.isSafeInteger(candidate.regionId) ||
      candidate.regionId < 1 ||
      !candidate.regionCode
    ))) {
      throw new Error('Resolved TEST region candidate is invalid.');
    }

    const [workflowRows] = await query(
      `SELECT id, status, workflow_type, document_type
         FROM workflow
        WHERE status = 'active'
          AND workflow_type = 'consent-cm-prefill'
          AND document_type = 'financial_overview'
        ORDER BY id ASC`
    );
    if (workflowRows.length !== 1) {
      throw new Error(`Expected exactly one active Financial Overview workflow; found ${workflowRows.length}.`);
    }
    config.financialOverviewWorkflowId = Number(workflowRows[0].id);
    if (!Number.isSafeInteger(config.financialOverviewWorkflowId) || config.financialOverviewWorkflowId < 1) {
      throw new Error('Resolved Financial Overview workflow id is invalid.');
    }

    const budgetPotOverride = config.budgetPotOverride
      ? Number(config.budgetPotOverride)
      : null;
    if (config.budgetPotOverride && (!Number.isSafeInteger(budgetPotOverride) || budgetPotOverride < 1)) {
      throw new Error('invalid_TWO_STEP_REVIEW_BUDGET_POT_ID');
    }
    const now = new Date();
    const fiscalStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    const fiscalYear = `${fiscalStartYear}-${fiscalStartYear + 1}`;
    const fundedCandidates = [];
    for (const candidate of regionCandidates) {
      const [regionPotRows] = await query(
        `SELECT pot_id
           FROM budget_pot_region
          WHERE region_code = ?
            ${budgetPotOverride ? 'AND pot_id = ?' : ''}
          ORDER BY pot_id ASC`,
        budgetPotOverride ? [candidate.regionCode, budgetPotOverride] : [candidate.regionCode]
      );
      const regionPotIds = Array.from(new Set(
        regionPotRows.map(row => Number(row.pot_id)).filter(value => Number.isSafeInteger(value) && value > 0)
      ));
      if (!regionPotIds.length) continue;
      const potPlaceholders = regionPotIds.map(() => '?').join(',');
      const [budgetPotRows] = await query(
        `SELECT id, is_active, pot_type, funding_source, gl_project_code_external,
                fiscal_year, fiscal_year_tag, adjusted_amount, committed_amount, actual_amount
           FROM budget_pot
          WHERE id IN (${potPlaceholders})
            AND is_active = 1
            AND pot_type = 'Funding stream'
            AND funding_source = 'CRF'
            AND gl_project_code_external IS NOT NULL
            AND gl_project_code_external <> ''
            AND (fiscal_year = ? OR fiscal_year_tag = ?)
          ORDER BY id ASC`,
        [...regionPotIds, fiscalYear, fiscalYear]
      );
      for (const budgetPot of budgetPotRows) {
        const budgetPotId = Number(budgetPot.id);
        const availableAmount = Number(budgetPot.adjusted_amount || 0)
          - Number(budgetPot.committed_amount || 0)
          - Number(budgetPot.actual_amount || 0);
        if (
          Number.isSafeInteger(budgetPotId) &&
          budgetPotId > 0 &&
          Number.isFinite(availableAmount) &&
          availableAmount >= 100
        ) {
          fundedCandidates.push({ ...candidate, budgetPotId, availableAmount });
        }
      }
    }
    if (!fundedCandidates.length) {
      const qualifier = budgetPotOverride ? `budget pot override ${budgetPotOverride}` : fiscalYear;
      throw new Error(`TEST has no verified region with an active chargeable CRF funding-stream budget pot and $100 capacity for ${qualifier}.`);
    }
    const selected = fundedCandidates[0];
    config.regionId = selected.regionId;
    config.budgetPotId = selected.budgetPotId;
    result.evidence.fixtureReferences = {
      regionId: config.regionId,
      regionCode: selected.regionCode,
      fiscalYear,
      financialOverviewWorkflowId: config.financialOverviewWorkflowId,
      budgetPotId: config.budgetPotId,
      budgetPotAvailableAmount: selected.availableAmount,
    };
    pass('TEST fixture references resolved from verified live rows', result.evidence.fixtureReferences);
  }

  async function requestAndSignFinancialOverview(auth, caseId, applicationId, siblingApplicationId, options = {}) {
    const targetReminderIds = fixture.reminders.dualRoleApplication || [];
    const siblingReminderIds = fixture.reminders.dualRoleSibling || [];
    const siblingRemindersBefore = reminderFingerprint(await getReminderRows(siblingReminderIds));
    fixture.reminderSentinels.dualRoleSibling = siblingRemindersBefore;
    requireInvariant('application assessment: sibling reminder baseline is complete before Financial Overview request', (
      siblingRemindersBefore.length === siblingReminderIds.length &&
      siblingRemindersBefore.every(row => (
        row.applicationId === Number(siblingApplicationId) &&
        row.status === 'open' &&
        row.deletedAt == null
      ))
    ), {
      siblingApplicationId,
      siblingReminderIds,
      siblingRemindersBefore,
    });
    const [[caseContextBeforeRow]] = await query(
      'SELECT case_context_json FROM iset_case WHERE id = ?',
      [caseId]
    );
    const caseContextBefore = parseJsonObject(caseContextBeforeRow?.case_context_json);
    const siblingContextBefore = parseJsonObject(
      caseContextBefore?.applicationDecisionLetters?.[String(siblingApplicationId)]
    );
    const message = await fetchJson(`/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { ...authHeaders(auth), 'Content-Type': 'application/json' },
      body: json({
        subject: `Financial Overview two-step review ${config.stamp}`,
        body: 'Please complete the Financial Overview requested during decision review.',
        urgent: false,
        toDisplayName: 'Two Step Applicant',
        fromDisplayName: 'Regional Manager Smoke',
        applicationId,
        attachments: [{ workflow_id: config.financialOverviewWorkflowId, financial_overview_mode: 'blank' }],
      }),
    });
    const thread = await fetchJson(`/api/cases/${caseId}/messages`, {
      headers: authHeaders(auth),
    });
    const sentMessage = (thread.items || []).find(item => Number(item.id) === Number(message.messageId));
    const signingAttachment = (sentMessage?.attachments || []).find(
      item => Number(item.workflow_id) === Number(config.financialOverviewWorkflowId)
    );
    if (!signingAttachment?.id) {
      throw new Error(`Financial Overview signing request missing from secure message ${message.messageId}`);
    }
    const [messageRows] = await query(
      `SELECT id, case_id, application_id, recipient_actor_type, recipient_user_id
         FROM messages
        WHERE id = ?`,
      [message.messageId]
    );
    const [messageSigningRows] = await query(
      `SELECT message_id, signing_request_id
         FROM message_signing_request
        WHERE message_id = ?
          AND signing_request_id = ?`,
      [message.messageId, signingAttachment.id]
    );
    const [requestedSigningRows] = await query(
      `SELECT id, workflow_id, case_id, participant_user_id, created_by_user_id, status,
              signed_at, completion_artifact_key, artifact_url, resolved_schema_json
         FROM signing_request
        WHERE id = ?`,
      [signingAttachment.id]
    );
    const requestedSchema = parseJsonObject(requestedSigningRows[0]?.resolved_schema_json);
    const requestedFundingOverviewVersionId = Number(
      requestedSchema?.meta?.fundingOverviewVersionId ??
      requestedSchema?.meta?.funding_overview_version_id
    ) || null;
    requireInvariant('application assessment: secure message and signing request retain exact application and participant scope', (
      messageRows.length === 1 &&
      Number(messageRows[0].id) === Number(message.messageId) &&
      Number(messageRows[0].case_id) === Number(caseId) &&
      Number(messageRows[0].application_id) === Number(applicationId) &&
      messageRows[0].recipient_actor_type === 'applicant_user' &&
      Number(messageRows[0].recipient_user_id) === Number(fixture.applicantUser) &&
      messageSigningRows.length === 1 &&
      Number(messageSigningRows[0].message_id) === Number(message.messageId) &&
      Number(messageSigningRows[0].signing_request_id) === Number(signingAttachment.id) &&
      requestedSigningRows.length === 1 &&
      Number(requestedSigningRows[0].workflow_id) === Number(config.financialOverviewWorkflowId) &&
      Number(requestedSigningRows[0].case_id) === Number(caseId) &&
      Number(requestedSigningRows[0].participant_user_id) === Number(fixture.applicantUser) &&
      Number(requestedSigningRows[0].created_by_user_id) === Number(fixture.staff.manager.staffUserId) &&
      requestedSigningRows[0].status === 'pending' &&
      requestedSigningRows[0].signed_at == null &&
      requestedSigningRows[0].completion_artifact_key == null &&
      requestedSigningRows[0].artifact_url == null &&
      Number.isSafeInteger(requestedFundingOverviewVersionId) &&
      requestedFundingOverviewVersionId > 0
    ), {
      caseId,
      applicationId,
      siblingApplicationId,
      applicantUserId: fixture.applicantUser,
      messageRows,
      messageSigningRows,
      requestedSigningRows,
    });
    const requestedState = await getApplicationState(applicationId);
    requireInvariant('application assessment: Financial Overview request preserves returned-to-RM review state', (
      requestedState?.current_stage === 'returned_to_rm' &&
      requestedState?.status === 'pending_approval' &&
      requestedState?.lifecycle_status === 'pending_decision' &&
      Number(requestedState?.docs_requested_active) === 1 &&
      requestedState?.docs_requested_source === 'secure_message'
    ), requestedState || {});
    pass('application assessment: Financial Overview requested on exact returned application', {
      caseId,
      applicationId,
      messageId: message.messageId,
      signingRequestId: signingAttachment.id,
    });
    const targetRemindersRequested = reminderFingerprint(await getReminderRows(targetReminderIds));
    const siblingRemindersRequested = reminderFingerprint(await getReminderRows(siblingReminderIds));
    requireInvariant('application assessment: document request updates only exact-application reminders', (
      targetRemindersRequested.length === targetReminderIds.length &&
      targetRemindersRequested.every(row => (
        row.applicationId === Number(applicationId) &&
        row.status === 'open' &&
        row.deletedAt == null
      )) &&
      json(siblingRemindersRequested) === json(siblingRemindersBefore)
    ), {
      applicationId,
      siblingApplicationId,
      targetRemindersRequested,
      siblingRemindersBefore,
      siblingRemindersRequested,
    });
    if (typeof options.beforeSign === 'function') {
      await options.beforeSign({
        signingRequestId: Number(signingAttachment.id),
        fundingOverviewVersionId: requestedFundingOverviewVersionId,
      });
    }
    const signingCompletion = await completeFinancialOverviewThroughPortal(
      signingAttachment.id,
      requestedFundingOverviewVersionId,
      { concurrentRmForward: options.concurrentRmForward || null }
    );
    const [signedRequestRows] = await query(
      `SELECT id, workflow_id, case_id, participant_user_id, created_by_user_id, status,
              signed_at, completion_token, completion_payload_hash, completion_artifact_key,
              completion_event_id, completion_claim_token, completion_claim_expires_at,
              artifact_url
         FROM signing_request
        WHERE id = ?`,
      [signingAttachment.id]
    );
    const [signedDocumentRows] = await query(
      `SELECT id, applicant_user_id, client_id, application_id, case_id, origin_message_id,
              signing_request_id, source, file_name, file_path, mime_type, metadata,
              checksum_sha256, status, document_category
         FROM iset_document
        WHERE signing_request_id = ?`,
      [signingAttachment.id]
    );
    const signedRequestRow = signedRequestRows[0] || null;
    const signedDocumentRow = signedDocumentRows[0] || null;
    if (signedRequestRow?.completion_artifact_key) fixture.documents.push(signedRequestRow.completion_artifact_key);
    if (signedRequestRow?.artifact_url) fixture.documents.push(signedRequestRow.artifact_url);
    if (signedDocumentRow?.file_path) fixture.documents.push(signedDocumentRow.file_path);
    const [versionDocumentRows] = signedDocumentRow
      ? await query(
          `SELECT id, funding_overview_version_id, document_type, document_id
             FROM funding_overview_version_documents
            WHERE document_id = ?`,
          [signedDocumentRow.id]
        )
      : [[]];
    const fundingOverviewVersionId = Number(versionDocumentRows[0]?.funding_overview_version_id) || null;
    const [versionRows] = fundingOverviewVersionId
      ? await query(
          `SELECT id, series_id, version_number, status, signed_at,
                  signed_by_participant_id, snapshot_schema_version, snapshot_hash,
                  rendered_template_version, metadata_json
             FROM funding_overview_version
            WHERE id = ?`,
          [fundingOverviewVersionId]
        )
      : [[]];
    const versionRow = versionRows[0] || null;
    const [seriesRows] = versionRow
      ? await query(
          `SELECT id, case_id, template_key
             FROM funding_overview_series
            WHERE id = ?`,
          [versionRow.series_id]
        )
      : [[]];
    const [caseFundingSeriesRows] = await query(
      `SELECT id
         FROM funding_overview_series
        WHERE case_id = ?
        ORDER BY id`,
      [caseId]
    );
    const caseFundingSeriesIds = caseFundingSeriesRows
      .map(row => Number(row.id))
      .filter(value => Number.isSafeInteger(value) && value > 0);
    const [allCaseVersionRows] = caseFundingSeriesIds.length
      ? await query(
          `SELECT metadata_json
             FROM funding_overview_version
            WHERE series_id IN (${caseFundingSeriesIds.map(() => '?').join(',')})
            ORDER BY id`,
          caseFundingSeriesIds
        )
      : [[]];
    const [[caseContextAfterRow]] = await query(
      'SELECT case_context_json FROM iset_case WHERE id = ?',
      [caseId]
    );
    const caseContextAfter = parseJsonObject(caseContextAfterRow?.case_context_json);
    const targetContextAfter = parseJsonObject(
      caseContextAfter?.applicationDecisionLetters?.[String(applicationId)]
    );
    const siblingContextAfter = parseJsonObject(
      caseContextAfter?.applicationDecisionLetters?.[String(siblingApplicationId)]
    );
    const versionSnapshot = parseJsonObject(versionRow?.metadata_json);
    const documentMetadata = parseJsonObject(signedDocumentRow?.metadata);
    const artifactMatchesDocument = Boolean(
      signedDocumentRow?.file_path &&
      (
        signedRequestRow?.completion_artifact_key === signedDocumentRow.file_path ||
        signedRequestRow?.artifact_url === signedDocumentRow.file_path ||
        String(signedRequestRow?.artifact_url || '').includes(encodeURIComponent(signedDocumentRow.file_path)) ||
        String(signedRequestRow?.artifact_url || '').includes(signedDocumentRow.file_path)
      )
    );
    expect('application assessment: signed Financial Overview is atomically linked to the exact repeat application and participant', (
      signedRequestRows.length === 1 &&
      signedRequestRow.status === 'signed' &&
      signedRequestRow.signed_at != null &&
      Number(signedRequestRow.case_id) === Number(caseId) &&
      Number(signedRequestRow.participant_user_id) === Number(fixture.applicantUser) &&
      typeof signedRequestRow.completion_token === 'string' && signedRequestRow.completion_token.length === 36 &&
      typeof signedRequestRow.completion_payload_hash === 'string' && signedRequestRow.completion_payload_hash.length === 64 &&
      typeof signedRequestRow.completion_event_id === 'string' && signedRequestRow.completion_event_id.length === 36 &&
      signedRequestRow.completion_claim_token == null &&
      signedRequestRow.completion_claim_expires_at == null &&
      signedDocumentRows.length === 1 &&
      Number(signedDocumentRow.case_id) === Number(caseId) &&
      Number(signedDocumentRow.application_id) === Number(applicationId) &&
      Number(signedDocumentRow.applicant_user_id) === Number(fixture.applicantUser) &&
      Number(signedDocumentRow.origin_message_id) === Number(message.messageId) &&
      Number(signedDocumentRow.signing_request_id) === Number(signingAttachment.id) &&
      signedDocumentRow.source === 'system_generated' &&
      signedDocumentRow.status === 'active' &&
      signedDocumentRow.document_category === 'financial_overview' &&
      signedDocumentRow.mime_type === 'application/pdf' &&
      typeof signedDocumentRow.checksum_sha256 === 'string' && signedDocumentRow.checksum_sha256.length === 64 &&
      artifactMatchesDocument &&
      Number(documentMetadata.application_id) === Number(applicationId) &&
      Number(documentMetadata.funding_overview_version_id) === Number(fundingOverviewVersionId) &&
      Number(fundingOverviewVersionId) === Number(requestedFundingOverviewVersionId) &&
      versionDocumentRows.length === 1 &&
      versionDocumentRows[0].document_type === 'signed' &&
      Number(versionDocumentRows[0].document_id) === Number(signedDocumentRow.id) &&
      versionRows.length === 1 &&
      versionRow.status === 'signed' &&
      versionRow.signed_at != null &&
      Number(versionRow.signed_by_participant_id) === Number(fixture.applicantUser) &&
      typeof versionRow.snapshot_hash === 'string' && versionRow.snapshot_hash.length === 64 &&
      seriesRows.length === 1 &&
      Number(seriesRows[0].case_id) === Number(caseId) &&
      Number(versionSnapshot?.case?.caseId) === Number(caseId) &&
      Number(versionSnapshot?.case?.applicationId) === Number(applicationId) &&
      Number(versionSnapshot?.case?.applicantUserId) === Number(fixture.applicantUser) &&
      versionSnapshot?.sourceAnswers?.['income-employment'] === '1640.50' &&
      versionSnapshot?.sourceAnswers?.['expenses-rent'] === '925.00' &&
      targetContextAfter?.applicationAnswers?.['income-employment'] === '1640.50' &&
      targetContextAfter?.applicationAnswers?.['expenses-rent'] === '925.00' &&
      json(siblingContextAfter) === json(siblingContextBefore) &&
      allCaseVersionRows.length === 1 &&
      allCaseVersionRows.every(row => (
        Number(parseJsonObject(row.metadata_json)?.case?.applicationId) === Number(applicationId)
      ))
    ), {
      caseId,
      applicationId,
      siblingApplicationId,
      applicantUserId: fixture.applicantUser,
      signedRequestRows,
      signedDocumentRows,
      versionDocumentRows,
      versionRows,
      seriesRows,
      targetContextAfter,
      siblingContextBefore,
      siblingContextAfter,
      allCaseVersionRows,
    });
    const targetRemindersSigned = reminderFingerprint(await getReminderRows(targetReminderIds));
    const siblingRemindersSigned = reminderFingerprint(await getReminderRows(siblingReminderIds));
    expect('application assessment: signing clears only exact-application reminders', (
      targetRemindersSigned.length === targetReminderIds.length &&
      targetRemindersSigned.every(row => (
        row.applicationId === Number(applicationId) &&
        row.status === 'cancelled' &&
        row.deletedAt != null
      )) &&
      json(siblingRemindersSigned) === json(siblingRemindersBefore)
    ), {
      applicationId,
      siblingApplicationId,
      targetRemindersSigned,
      siblingRemindersBefore,
      siblingRemindersSigned,
    });
    return {
      signingRequestId: Number(signingAttachment.id),
      fundingOverviewVersionId: requestedFundingOverviewVersionId,
      serializedPayload: signingCompletion.serializedPayload,
      cookieHeader: signingCompletion.cookieHeader,
    };
  }

  async function requestPendingFinancialOverviewForResubmitRace(auth, caseId, applicationId) {
    const message = await fetchJson(`/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { ...authHeaders(auth), 'Content-Type': 'application/json' },
      body: json({
        subject: `Financial Overview resubmit race ${config.stamp}`,
        body: 'Synthetic second Financial Overview request for the signing-versus-resubmit serialization check.',
        urgent: false,
        toDisplayName: 'Two Step Applicant',
        fromDisplayName: 'Regional Manager Smoke',
        applicationId,
        attachments: [{ workflow_id: config.financialOverviewWorkflowId, financial_overview_mode: 'blank' }],
      }),
    });
    const thread = await fetchJson(`/api/cases/${caseId}/messages`, {
      headers: authHeaders(auth),
    });
    const sentMessage = (thread.items || []).find(item => Number(item.id) === Number(message.messageId));
    const signingAttachment = (sentMessage?.attachments || []).find(
      item => Number(item.workflow_id) === Number(config.financialOverviewWorkflowId)
    );
    const signingRequestId = Number(signingAttachment?.id) || null;
    if (!Number.isSafeInteger(signingRequestId) || signingRequestId <= 0) {
      throw new Error(`Resubmit-race Financial Overview signing request missing from message ${message.messageId}`);
    }
    const [messageRows] = await query(
      `SELECT id, case_id, application_id, recipient_actor_type, recipient_user_id
         FROM messages
        WHERE id = ?`,
      [message.messageId]
    );
    const [messageSigningRows] = await query(
      `SELECT message_id, signing_request_id
         FROM message_signing_request
        WHERE message_id = ?
          AND signing_request_id = ?`,
      [message.messageId, signingRequestId]
    );
    const [signingRows] = await query(
      `SELECT id, workflow_id, case_id, participant_user_id, created_by_user_id,
              status, signed_at, completion_artifact_key, artifact_url,
              resolved_schema_json
         FROM signing_request
        WHERE id = ?`,
      [signingRequestId]
    );
    const signingRow = signingRows[0] || null;
    const resolvedSchema = parseJsonObject(signingRow?.resolved_schema_json);
    const fundingOverviewVersionId = Number(
      resolvedSchema?.meta?.fundingOverviewVersionId ??
      resolvedSchema?.meta?.funding_overview_version_id
    ) || null;
    const [versionRows] = fundingOverviewVersionId
      ? await query(
          `SELECT id, status, signed_at, signed_by_participant_id
             FROM funding_overview_version
            WHERE id = ?`,
          [fundingOverviewVersionId]
        )
      : [[]];
    const requestState = await getApplicationState(applicationId);
    requireInvariant('application assessment: resubmit race owns one exact pending Financial Overview request', (
      messageRows.length === 1 &&
      Number(messageRows[0]?.case_id) === Number(caseId) &&
      Number(messageRows[0]?.application_id) === Number(applicationId) &&
      messageRows[0]?.recipient_actor_type === 'applicant_user' &&
      Number(messageRows[0]?.recipient_user_id) === Number(fixture.applicantUser) &&
      messageSigningRows.length === 1 &&
      Number(messageSigningRows[0]?.signing_request_id) === signingRequestId &&
      signingRows.length === 1 &&
      Number(signingRow?.workflow_id) === Number(config.financialOverviewWorkflowId) &&
      Number(signingRow?.case_id) === Number(caseId) &&
      Number(signingRow?.participant_user_id) === Number(fixture.applicantUser) &&
      Number(signingRow?.created_by_user_id) === Number(fixture.staff.manager.staffUserId) &&
      signingRow?.status === 'pending' &&
      signingRow?.signed_at == null &&
      signingRow?.completion_artifact_key == null &&
      signingRow?.artifact_url == null &&
      Number.isSafeInteger(fundingOverviewVersionId) &&
      fundingOverviewVersionId > 0 &&
      versionRows.length === 1 &&
      versionRows[0]?.status === 'sent' &&
      versionRows[0]?.signed_at == null &&
      versionRows[0]?.signed_by_participant_id == null &&
      requestState?.current_stage === 'returned_to_submitter' &&
      Number(requestState?.docs_requested_active) === 1
    ), {
      caseId,
      applicationId,
      messageId: message.messageId,
      signingRequestId,
      fundingOverviewVersionId,
      messageRows,
      messageSigningRows,
      signingRows,
      versionRows,
      requestState,
    });
    return {
      messageId: Number(message.messageId),
      signingRequestId,
      fundingOverviewVersionId,
    };
  }

  async function assertReturnedApplicationInRmQueue(auth, caseId, applicationId, siblingApplicationId) {
    const queue = await fetchJson('/api/dashboard/awaiting-approval-items', {
      headers: authHeaders(auth),
    });
    const targetItems = (queue.items || []).filter(item => (
      Number(item.caseId) === Number(caseId) &&
      Number(item.applicationId) === Number(applicationId)
    ));
    const siblingItems = (queue.items || []).filter(item => (
      Number(item.caseId) === Number(caseId) &&
      Number(item.applicationId) === Number(siblingApplicationId)
    ));
    expect('application assessment: RM queue returns the exact non-primary damaged application only', (
      targetItems.length === 1 &&
      targetItems[0].review_workflow_stage === 'returned_to_rm' &&
      siblingItems.length === 0
    ), { caseId, applicationId, siblingApplicationId, targetItems, siblingItems });

    const completionQueue = await fetchJson('/api/dashboard/intervention-completion-items', {
      headers: authHeaders(auth),
    });
    const completionItems = (completionQueue.items || []).filter(item => (
      Number(item.caseId ?? item.case_id) === Number(caseId) &&
      (
        Number(item.interventionId ?? item.intervention_id) === Number(fixture.interventions.dualRoleCompletion) ||
        Number(item.proposalId ?? item.proposal_id) === Number(fixture.proposals.dualRoleCompletion)
      )
    ));
    requireInvariant('application assessment: returned Pending Review item coexists with the existing approved Pending Completion item', (
      targetItems.length === 1 &&
      completionItems.length === 1
    ), {
      caseId,
      applicationId,
      returnedReviewItems: targetItems,
      approvedCompletionItems: completionItems,
    });
  }

  async function assertDecisionMakerQueueAndOpen(auth, caseId, applicationId, siblingApplicationId) {
    const queue = await fetchJson('/api/dashboard/awaiting-approval-items', {
      headers: authHeaders(auth),
    });
    const targetItems = (queue.items || []).filter(item => (
      Number(item.caseId) === Number(caseId) &&
      Number(item.applicationId) === Number(applicationId)
    ));
    const siblingItems = (queue.items || []).filter(item => (
      Number(item.caseId) === Number(caseId) &&
      Number(item.applicationId) === Number(siblingApplicationId)
    ));
    requireInvariant('application assessment: corrected resubmission reaches the Decision Maker exact-application queue', (
      targetItems.length === 1 &&
      targetItems[0]?.review_workflow_stage === 'nwac_review' &&
      siblingItems.length === 0
    ), { caseId, applicationId, siblingApplicationId, targetItems, siblingItems });
    await assertRouteText(
      auth,
      `/application-case/${caseId}?applicationId=${applicationId}&entry=approval&approvalType=application&step=decision`,
      ['NWAC approval review', 'Decision Maker', 'Commit'],
      'corrected application assessment Decision Maker review'
    );
  }

  async function seedFixture() {
    progress('seed fixture starting');
    await query('START TRANSACTION');
    try {
      const suffix = fixture.suffix;
      for (const user of config.staffUsers) {
        const displayName = `${user.role} Smoke ${suffix}`;
        const staffUserId = await insert(
          `INSERT INTO user (name, email, cognito_sub, email_verified, suspended, preferred_language)
           VALUES (?, ?, ?, 1, 0, 'en')`,
          [displayName, user.email, user.sub]
        );
        const staffProfileId = await insert(
          `INSERT INTO staff_profiles
             (cognito_sub, email, name, display_name, primary_role, status, region_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'active', ?, NOW(), NOW())`,
          [user.sub, user.email, displayName, displayName, user.role, config.regionId]
        );
        await query(
          `INSERT INTO staff_region (staff_profile_id, region_id)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE updated_at = NOW()`,
          [staffProfileId, config.regionId]
        );
        fixture.staff[user.key] = { staffUserId, staffProfileId, email: user.email, role: user.role, sub: user.sub };
      }

      fixture.applicantUser = await insert(
        `INSERT INTO user (name, email, cognito_sub, email_verified, suspended, preferred_language)
         VALUES (?, ?, ?, 1, 0, 'en')`,
        [`Two Step Applicant ${suffix}`, config.applicantUser.email, config.applicantUser.sub]
      );
      fixture.client = await insert(
        `INSERT INTO client
           (first_name, last_name, applicant_cognito_sub, applicant_cognito_username,
            applicant_account_status, applicant_account_email, applicant_activated_at, address_json)
         VALUES (?, ?, ?, ?, 'activated', ?, NOW(), CAST(? AS JSON))`,
        ['Two Step', `Applicant ${suffix}`, config.applicantUser.sub, config.applicantUser.email, config.applicantUser.email, markerJson()]
      );

      await seedApplicationAssessmentCase('application');
      await seedApplicationAssessmentCase('dualRoleApplication', {
        assignedStaffProfileId: fixture.staff.manager.staffProfileId,
      });
      await seedRepeatApplicationSibling('dualRoleSibling', 'dualRoleApplication');
      await seedPendingCompletionIntervention();
      await seedDocsReminderPair('dualRoleApplication', 'dualRoleApplication');
      await seedDocsReminderPair('dualRoleSibling', 'dualRoleSibling');
      await seedInterventionCase('proposal');
      await seedInterventionCase('revision');
      await seedInterventionCase('rmProposal');

      await query('COMMIT');
      result.fixtureIds = {
        stamp: config.stamp,
        staff: Object.fromEntries(Object.entries(fixture.staff).map(([key, value]) => [key, value.staffProfileId])),
        cases: fixture.cases,
        applications: fixture.applications,
        actionPlans: fixture.actionPlans,
        interventions: fixture.interventions,
      };
      pass('TEST synthetic two-step fixture seeded', result.fixtureIds);
      progress('seed fixture committed');
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  }

  async function seedApplicationAssessmentCase(label, options = {}) {
    const suffix = fixture.suffix;
    const assignedStaffProfileId = Number(options.assignedStaffProfileId) || fixture.staff.coordinator.staffProfileId;
    const reference = `TSTEPA-${label}-${suffix}`.slice(0, 32);
    const answers = {
      'first-name': 'Two',
      'last-name': `Assessment ${suffix}`,
      'preferred-name': 'Two',
      email: `codex.twostep.${suffix}.assessment@example.com`,
      'address-province': 'QC',
    };
    const payload = { ...fixture.marker, answers, submission_snapshot: { reference_number: reference } };
    const submissionId = await insert(
      `INSERT INTO iset_application_submission
         (user_id, workflow_id, reference_number, status, submitted_at, intake_payload, schema_snapshot, history, doc_refs, locale)
       VALUES (?, 'iset-v1', ?, 'submitted', NOW(), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), 'en')`,
      [fixture.applicantUser, reference, json(answers), markerJson(), json([]), json([])]
    );
    const caseId = await insert(
      `INSERT INTO iset_case
         (case_number, client_id, assigned_staff_profile_id, status, lifecycle_status, stage,
          opened_at, portfolio_region_id, case_context_json, created_by_staff_profile_id, updated_by_staff_profile_id)
       VALUES (?, ?, ?, 'intake', 'intake', 'two_step_smoke', NOW(), ?, CAST(? AS JSON), ?, ?)`,
      [
        `TSTEP-${label}-${suffix}`.slice(0, 32),
        fixture.client,
        assignedStaffProfileId,
        config.regionId,
        markerJson({ kind: label }),
        assignedStaffProfileId,
        assignedStaffProfileId,
      ]
    );
    const applicationId = await insert(
      `INSERT INTO iset_application
         (submission_id, client_id, case_id, payload_json, status, lifecycle_status,
          decision_outcome, awaiting_reason, created_at, updated_at, row_version)
       VALUES (?, ?, ?, CAST(? AS JSON), 'in_review', 'in_review', NULL, NULL, NOW(), NOW(), 1)`,
      [submissionId, fixture.client, caseId, json(payload)]
    );
    await query(
      `INSERT INTO iset_application_assessment
         (application_id, case_id, date_of_assessment, overview, employment_goals,
          previous_iset, employment_barriers, local_area_priorities, other_funding_details,
          esdc_eligibility, intervention_start_date, intervention_end_date,
          intervention_budget_pot_id, posting_context, intervention_code,
          intervention_outcome_code, intervention_duration_days, intervention_cost_total,
          institution, program_name, itp_payload, wage_payload, recommendation,
          justification, proposed_interventions, childcare_need, created_at, updated_at)
       VALUES (?, ?, CURRENT_DATE(), ?, ?, 0, CAST(? AS JSON), CAST(? AS JSON), ?,
          'CRF', ?, ?, ?, 'external', 4, 1, 106, 100,
          'Smoke College', 'Smoke Certificate', CAST(? AS JSON), CAST(? AS JSON),
          'recommend', ?, CAST(? AS JSON), 0, NOW(), NOW())`,
      [
        applicationId,
        caseId,
        'Synthetic assessment case for two-step review smoke.',
        'Complete short training and move into employment.',
        json(['Lack of Marketable Skills']),
        json(['Off Reserve']),
        'No other funding identified.',
        smokeDates.assessmentStart,
        smokeDates.assessmentEnd,
        config.budgetPotId,
        json({ tuition: '', books: '', materials: '', living: '', childcare: '', otherLabel: '', otherAmount: '', details: 'Training plan details.' }),
        json({ wages: '', mercs: '', nonwages: '', other1Label: '', other1Amount: '', other2Label: '', other2Amount: '', subsidyDetails: '' }),
        'Synthetic recommendation is aligned with employment goals.',
        json([
          {
            id: `two-step-assessment-${suffix}`,
            code: '4',
            startDate: smokeDates.assessmentStart,
            endDate: smokeDates.assessmentEnd,
            deliveryMode: 'partner',
            institution: 'Smoke College',
            programName: 'Smoke Certificate',
            itpDetails: 'Training plan details.',
            costLines: [{ id: 'tuition', label: 'Tuition', paymentType: 'tuition', payeeType: 'institution', payeeName: 'Smoke College', amount: '100' }],
          },
        ]),
      ]
    );
    fixture.submissions[label] = submissionId;
    fixture.cases[label] = caseId;
    fixture.applications[label] = applicationId;
  }

  async function seedRepeatApplicationSibling(label, caseLabel) {
    const suffix = fixture.suffix;
    const caseId = fixture.cases[caseLabel];
    const reference = `TSTEPA-${label}-${suffix}`.slice(0, 32);
    const answers = {
      'first-name': 'Two',
      'last-name': `Sibling ${suffix}`,
      email: `codex.twostep.${suffix}.sibling@example.com`,
      'address-province': 'QC',
    };
    const submissionId = await insert(
      `INSERT INTO iset_application_submission
         (user_id, workflow_id, reference_number, status, submitted_at, intake_payload, schema_snapshot, history, doc_refs, locale)
       VALUES (?, 'iset-v1', ?, 'submitted', NOW(), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), 'en')`,
      [fixture.applicantUser, reference, json(answers), markerJson(), json([]), json([])]
    );
    const applicationId = await insert(
      `INSERT INTO iset_application
         (submission_id, client_id, case_id, payload_json, status, lifecycle_status,
          decision_outcome, awaiting_reason, created_at, updated_at, row_version)
       VALUES (?, ?, ?, CAST(? AS JSON), 'in_review', 'in_review', NULL, 'none', NOW(), NOW(), 1)`,
      [
        submissionId,
        fixture.client,
        caseId,
        markerJson({ kind: label, submission_snapshot: { reference_number: reference } }),
      ]
    );
    const siblingAssessmentOverview = `SIBLING-ASSESSMENT-SENTINEL-${config.stamp}`;
    await query(
      `INSERT INTO iset_application_assessment
         (application_id, case_id, date_of_assessment, overview, employment_goals,
          previous_iset, employment_barriers, local_area_priorities, other_funding_details,
          esdc_eligibility, intervention_start_date, intervention_end_date,
          intervention_budget_pot_id, posting_context, intervention_code,
          intervention_outcome_code, intervention_duration_days, intervention_cost_total,
          institution, program_name, itp_payload, wage_payload, recommendation,
          justification, proposed_interventions, childcare_need, created_at, updated_at)
       VALUES (?, ?, CURRENT_DATE(), ?, ?, 0, CAST(? AS JSON), CAST(? AS JSON), ?,
          'CRF', ?, ?, ?, 'external', 4, 1, 106, 100,
          'Sibling Smoke College', 'Sibling Smoke Certificate', CAST(? AS JSON), CAST(? AS JSON),
          'recommend', ?, CAST(? AS JSON), 0, NOW(), NOW())`,
      [
        applicationId,
        caseId,
        siblingAssessmentOverview,
        'Sibling employment goal must remain unchanged.',
        json(['Sibling barrier sentinel']),
        json(['Sibling priority sentinel']),
        'Sibling funding sentinel.',
        smokeDates.assessmentStart,
        smokeDates.assessmentEnd,
        config.budgetPotId,
        json({ details: 'Sibling ITP sentinel.' }),
        json({ subsidyDetails: 'Sibling wage sentinel.' }),
        'Sibling justification sentinel.',
        json([{ id: `sibling-sentinel-${suffix}`, code: '4', amount: '100' }]),
      ]
    );
    fixture.submissions[label] = submissionId;
    fixture.applications[label] = applicationId;
    fixture.assessmentSentinels[label] = siblingAssessmentOverview;
  }

  async function seedPendingCompletionIntervention() {
    const caseId = fixture.cases.dualRoleApplication;
    const applicationId = fixture.applications.dualRoleApplication;
    const planId = await insert(
      `INSERT INTO iset_case_action_plan
         (case_id, application_id, name, status, budget_pot, funding_stream,
          owner_staff_profile_id, effective_date, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, 'CRF', ?, CURRENT_DATE(), CAST(? AS JSON), NOW(), NOW())`,
      [
        caseId,
        applicationId,
        `Approved intervention coexistence ${fixture.suffix}`,
        String(config.budgetPotId),
        fixture.staff.manager.staffProfileId,
        markerJson({ kind: 'pending-completion-coexistence', postingContext: 'external' }),
      ]
    );
    const interventionId = await insert(
      `INSERT INTO iset_case_intervention
         (case_id, action_plan_id, intervention_code, status, delivery_status,
          start_date, end_date, duration_days, budget_amount, approved_amount,
          intervention_cost, notes, metadata_json, esdc_intervention_json,
          created_by_staff_profile_id, reviewed_by_staff_profile_id, reviewed_at,
          eligibility_result, funding_stream_decision)
       VALUES (?, ?, 3, 'approved', 'planned', ?, ?, 31,
          100.00, 100.00, 100.00, 'Approved intervention remains in Pending Completion.',
          CAST(? AS JSON), CAST(? AS JSON), ?, ?, NOW(), 'eligible', 'CRF')`,
      [
        caseId,
        planId,
        smokeDates.sourceStart,
        smokeDates.sourceEnd,
        markerJson({
          kind: 'pending-completion-coexistence',
          title: 'Approved intervention Pending Completion sentinel',
          code: '3',
          cost: 100,
          postingContext: 'external',
        }),
        json({
          interventionCode: '3',
          interventionStartDate: smokeDates.sourceStart,
          interventionEndDate: smokeDates.sourceEnd,
          interventionCost: 100,
        }),
        fixture.staff.manager.staffProfileId,
        fixture.staff.decisionMaker.staffProfileId,
      ]
    );
    const proposalId = await insert(
      `INSERT INTO iset_intervention_proposal
         (case_id, action_plan_id, application_id, legacy_intervention_id,
          source_intervention_id, proposal_kind, review_status, title,
          intervention_code, start_date, end_date, proposed_cost,
          decision_reason, decision_notes, payload_json, metadata_json,
          submitted_by_staff_profile_id, reviewed_by_staff_profile_id,
          submitted_at, reviewed_at)
       VALUES (?, ?, ?, ?, NULL, 'new', 'approved', ?, 3, ?, ?, 100.00,
          NULL, 'Approved intervention coexistence sentinel.', CAST(? AS JSON), CAST(? AS JSON),
          ?, ?, NOW(), NOW())`,
      [
        caseId,
        planId,
        applicationId,
        interventionId,
        'Approved intervention Pending Completion sentinel',
        smokeDates.sourceStart,
        smokeDates.sourceEnd,
        markerJson({ kind: 'pending-completion-coexistence', reviewStatus: 'approved' }),
        markerJson({ kind: 'pending-completion-coexistence', title: 'Approved intervention Pending Completion sentinel' }),
        fixture.staff.manager.staffProfileId,
        fixture.staff.decisionMaker.staffProfileId,
      ]
    );
    fixture.actionPlans.dualRoleCompletion = planId;
    fixture.interventions.dualRoleCompletion = interventionId;
    fixture.proposals.dualRoleCompletion = proposalId;
  }

  async function seedDocsReminderPair(label, applicationLabel) {
    const caseId = fixture.cases.dualRoleApplication;
    const applicationId = fixture.applications[applicationLabel];
    const reminders = [];
    for (const [kind, offsetDays] of [['reminder', 30], ['closure', 60]]) {
      const reminderId = await insert(
        `INSERT INTO iset_case_reminder
           (case_id, application_id, title, description, category, status, due_at,
            metadata_json, created_by_staff_profile_id, updated_by_staff_profile_id)
         VALUES (?, ?, ?, ?, 'Docs requested', 'open', ?, CAST(? AS JSON), ?, ?)`,
        [
          caseId,
          applicationId,
          `Synthetic ${label} ${kind}`,
          `Synthetic exact-application ${kind} scope guard.`,
          dateFromNow(offsetDays),
          markerJson({ source: 'docs_requested', kind }),
          fixture.staff.manager.staffProfileId,
          fixture.staff.manager.staffProfileId,
        ]
      );
      reminders.push(reminderId);
    }
    fixture.reminders[label] = reminders;
  }

  async function seedInterventionCase(label) {
    const suffix = fixture.suffix;
    const reference = `TSTEPI-${label}-${suffix}`.slice(0, 32);
    const answers = {
      'first-name': 'Two',
      'last-name': `${label} ${suffix}`,
      email: `codex.twostep.${suffix}.${label}@example.com`,
      'address-province': 'QC',
    };
    const payload = { ...fixture.marker, answers, submission_snapshot: { reference_number: reference } };
    const submissionId = await insert(
      `INSERT INTO iset_application_submission
         (user_id, workflow_id, reference_number, status, submitted_at, intake_payload, schema_snapshot, history, doc_refs, locale)
       VALUES (?, 'iset-v1', ?, 'submitted', NOW(), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), 'en')`,
      [fixture.applicantUser, reference, json(answers), markerJson(), json([]), json([])]
    );
    const caseId = await insert(
      `INSERT INTO iset_case
         (case_number, client_id, assigned_staff_profile_id, status, lifecycle_status, stage,
          opened_at, portfolio_region_id, case_context_json, created_by_staff_profile_id, updated_by_staff_profile_id)
       VALUES (?, ?, ?, 'active', 'active', 'two_step_smoke', NOW(), ?, CAST(? AS JSON), ?, ?)`,
      [
        `TSTEP-${label}-${suffix}`.slice(0, 32),
        fixture.client,
        fixture.staff.coordinator.staffProfileId,
        config.regionId,
        markerJson({ kind: label }),
        fixture.staff.coordinator.staffProfileId,
        fixture.staff.coordinator.staffProfileId,
      ]
    );
    const applicationId = await insert(
      `INSERT INTO iset_application
         (submission_id, client_id, case_id, payload_json, status, lifecycle_status,
          decision_outcome, awaiting_reason, created_at, updated_at, row_version)
       VALUES (?, ?, ?, CAST(? AS JSON), 'approved', 'decision_recorded', 'approved', NULL, NOW(), NOW(), 1)`,
      [submissionId, fixture.client, caseId, json(payload)]
    );
    const actionPlanId = await insert(
      `INSERT INTO iset_case_action_plan
         (case_id, application_id, name, status, budget_pot, funding_stream,
          owner_staff_profile_id, effective_date, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, 'CRF', ?, CURRENT_DATE(), CAST(? AS JSON), NOW(), NOW())`,
      [
        caseId,
        applicationId,
        `Two-step smoke plan ${label}`,
        String(config.budgetPotId),
        fixture.staff.coordinator.staffProfileId,
        markerJson({ kind: label, postingContext: 'external' }),
      ]
    );
    fixture.submissions[label] = submissionId;
    fixture.cases[label] = caseId;
    fixture.applications[label] = applicationId;
    fixture.actionPlans[label] = actionPlanId;

    if (label === 'revision') {
      const sourceInterventionId = await insert(
        `INSERT INTO iset_case_intervention
           (case_id, action_plan_id, intervention_code, status, delivery_status,
            start_date, end_date, duration_days, budget_amount, approved_amount,
            intervention_cost, notes, metadata_json, esdc_intervention_json,
            created_by_staff_profile_id, reviewed_by_staff_profile_id, reviewed_at,
            eligibility_result, funding_stream_decision)
         VALUES (?, ?, 3, 'approved', 'planned', ?, ?, 31,
            100.00, 100.00, 100.00, 'Synthetic approved source intervention.',
            CAST(? AS JSON), CAST(? AS JSON), ?, ?, NOW(), 'eligible', 'CRF')`,
        [
          caseId,
          actionPlanId,
          smokeDates.sourceStart,
          smokeDates.sourceEnd,
          markerJson({ kind: label, title: 'Approved source intervention', code: '3', cost: 100, postingContext: 'external' }),
          json({ interventionCode: '3', interventionStartDate: smokeDates.sourceStart, interventionEndDate: smokeDates.sourceEnd, interventionCost: 100 }),
          fixture.staff.coordinator.staffProfileId,
          fixture.staff.decisionMaker.staffProfileId,
        ]
      );
      fixture.interventions.revisionSource = sourceInterventionId;
    }
  }

  async function verifyRuntimeConfig() {
    const [rows] = await query(
      `SELECT scope, k, CAST(v AS CHAR) AS \`value_json\`
         FROM iset_runtime_config
        WHERE k = 'workflow.two_step_rm_review.enabled'`
    );
    const value = rows[0]?.value_json || '';
    expect('TEST runtime flag includes all three two-step workflows', (
      value.includes('application_assessment') &&
      value.includes('intervention_proposal') &&
      value.includes('intervention_revision')
    ), { value });
    const [settings] = await query(
      `SELECT event, role, enabled, email_alert, bell_alert
         FROM notification_setting
        WHERE event IN ('assessment_submitted','rm_review_requested','rm_review_returned_to_submitter',
                        'rm_review_changes_forwarded','rm_review_submitted_to_nwac','nwac_review_changes_requested')
        ORDER BY event, role`
    );
    const rmRequested = settings.find(row => row.event === 'rm_review_requested' && row.role === 'Regional Manager');
    const legacyAdmin = settings.filter(row => row.event === 'assessment_submitted' && ['NWAC Administrator', 'Regional Manager'].includes(row.role));
    expect('TEST notification config uses RM review events', Boolean(rmRequested && Number(rmRequested.enabled) === 1 && Number(rmRequested.bell_alert) === 1), { rmRequested });
    expect('TEST legacy assessment_submitted admin/RM rows are disabled', legacyAdmin.every(row => Number(row.enabled) === 0 && Number(row.bell_alert) === 0), { legacyAdmin });
  }

  function completeAssessmentPayload(applicationId, expectedRowVersion = null, overrides = {}) {
    const payload = {
      applicationId,
      expectedRowVersion,
      case_summary: 'Synthetic assessment case for two-step review smoke.',
      assessment_employment_goals: 'Complete short training and move into employment.',
      assessment_previous_iset: 'no',
      assessment_employment_barriers: ['Lack of Marketable Skills'],
      assessment_local_area_priorities: ['Off Reserve'],
      assessment_other_funding_details: 'No other funding identified.',
      assessment_esdc_eligibility: 'CRF',
      assessment_intervention_start_date: smokeDates.assessmentStart,
      assessment_intervention_end_date: smokeDates.assessmentEnd,
      assessment_institution: 'Smoke College',
      assessment_program_name: 'Smoke Certificate',
      assessment_itp: { tuition: '', books: '', materials: '', living: '', childcare: '', otherLabel: '', otherAmount: '', details: 'Training plan details.' },
      assessment_wage: { wages: '', mercs: '', nonwages: '', other1Label: '', other1Amount: '', other2Label: '', other2Amount: '', subsidyDetails: '' },
      assessment_recommendation: 'recommend',
      assessment_justification: 'Synthetic recommendation is aligned with employment goals.',
      assessment_intervention_code: '4',
      assessment_intervention_outcome_code: '1',
      assessment_intervention_duration_days: '106',
      assessment_intervention_cost_total: '100',
      assessment_intervention_pot_id: String(config.budgetPotId),
      postingContext: 'external',
      assessment_childcare_need: 'no',
      assessment_proposed_interventions: [
        {
          id: `two-step-assessment-${fixture.suffix}`,
          code: '4',
          startDate: smokeDates.assessmentStart,
          endDate: smokeDates.assessmentEnd,
          deliveryMode: 'partner',
          institution: 'Smoke College',
          programName: 'Smoke Certificate',
          itpDetails: 'Training plan details.',
          costLines: [{ id: 'tuition', label: 'Tuition', paymentType: 'tuition', payeeType: 'institution', payeeName: 'Smoke College', amount: '100' }],
        },
      ],
      ...overrides,
    };
    if (!expectedRowVersion) delete payload.expectedRowVersion;
    return payload;
  }

  async function getApplicationState(applicationId) {
    const [[applicationRow]] = await query(
      `SELECT id, case_id, status, lifecycle_status, decision_outcome, awaiting_reason,
              docs_requested_active, docs_requested_source, row_version
         FROM iset_application
        WHERE id = ?
        LIMIT 1`,
      [applicationId]
    );
    if (!applicationRow) return null;
    const [workflowRows] = await query(
      `SELECT id, current_stage, current_owner_role, submitted_by_staff_profile_id, nwac_decision
         FROM iset_review_workflow
        WHERE workflow_type = 'application_assessment'
          AND application_id = ?
          AND archived_at IS NULL
        ORDER BY id ASC`,
      [applicationId]
    );
    if (workflowRows.length > 1) {
      throw new Error(`Application ${applicationId} has multiple active assessment review workflows.`);
    }
    const workflowRow = workflowRows[0] || null;
    return {
      ...applicationRow,
      workflow_id: workflowRow?.id || null,
      current_stage: workflowRow?.current_stage || null,
      current_owner_role: workflowRow?.current_owner_role || null,
      submitted_by_staff_profile_id: workflowRow?.submitted_by_staff_profile_id || null,
      nwac_decision: workflowRow?.nwac_decision || null,
    };
  }

  async function getApplicationAssessmentBodyState(applicationId) {
    const [[row]] = await query(
      `SELECT application_id, case_id, overview
         FROM iset_application_assessment
        WHERE application_id = ?
        LIMIT 1`,
      [applicationId]
    );
    return row || null;
  }

  async function getApplicationSentinelState(applicationId) {
    const [[row]] = await query(
      `SELECT id, submission_id, client_id, case_id, payload_json, status,
              lifecycle_status, decision_outcome, awaiting_reason, closure_reason,
              docs_requested_active, docs_requested_at, docs_requested_cleared_at,
              docs_requested_source, row_version, created_at, updated_at
         FROM iset_application
        WHERE id = ?
        LIMIT 1`,
      [applicationId]
    );
    return row || null;
  }

  async function captureReturnedAssessmentResubmitState(caseId, applicationId, workflowId) {
    const application = await getApplicationState(applicationId);
    const [documents] = await query(
      `SELECT id, file_path, source, status, document_category, metadata,
              checksum_sha256, signing_request_id
         FROM iset_document
        WHERE application_id = ?
          AND source = 'system_generated'
        ORDER BY id`,
      [applicationId]
    );
    const [workflowEvents] = await query(
      `SELECT id, review_workflow_id, action, from_stage, to_stage
         FROM iset_review_workflow_event
        WHERE review_workflow_id = ?
        ORDER BY id`,
      [workflowId]
    );
    const [caseEvents] = await query(
      `SELECT id, event_type, payload_json
         FROM iset_event_entry
        WHERE subject_type = 'case'
          AND subject_id = ?
        ORDER BY id`,
      [String(caseId)]
    );
    return {
      application,
      documents: documents || [],
      workflowEvents: workflowEvents || [],
      caseEvents: caseEvents || [],
      objectInventory: listFixturePrefixInventory(),
    };
  }

  async function captureFinancialOverviewSigningState(signingRequestId, fundingOverviewVersionId) {
    const [signingRequests] = await query(
      `SELECT id, case_id, participant_user_id, status, signed_at,
              completion_artifact_key, completion_event_id,
              completion_claim_token, completion_claim_expires_at
         FROM signing_request
        WHERE id = ?`,
      [signingRequestId]
    );
    const [documents] = await query(
      `SELECT id, case_id, application_id, applicant_user_id, signing_request_id,
              file_path, checksum_sha256, status, document_category, metadata
         FROM iset_document
        WHERE signing_request_id = ?
        ORDER BY id`,
      [signingRequestId]
    );
    const [versionDocuments] = await query(
      `SELECT id, funding_overview_version_id, document_type, document_id
         FROM funding_overview_version_documents
        WHERE funding_overview_version_id = ?
        ORDER BY id`,
      [fundingOverviewVersionId]
    );
    const [versions] = await query(
      `SELECT id, series_id, version_number, status, signed_at,
              signed_by_participant_id, snapshot_schema_version, snapshot_hash,
              rendered_template_version, metadata_json
         FROM funding_overview_version
        WHERE id = ?`,
      [fundingOverviewVersionId]
    );
    return {
      signingRequests: signingRequests || [],
      documents: documents || [],
      versionDocuments: versionDocuments || [],
      versions: versions || [],
    };
  }

  function rowsAddedById(beforeRows, afterRows) {
    const beforeIds = new Set((beforeRows || []).map(row => String(row.id)));
    return (afterRows || []).filter(row => !beforeIds.has(String(row.id)));
  }

  function objectEntriesAdded(beforeRows, afterRows) {
    const identity = row => `${row.kind || 'current'}\u0000${row.key}\u0000${row.versionId || ''}`;
    const beforeIdentities = new Set((beforeRows || []).map(identity));
    return (afterRows || []).filter(row => !beforeIdentities.has(identity(row)));
  }

  async function verifyReturnedAssessmentResubmitRaceCardinality({
    caseId,
    applicationId,
    baseline,
    after,
    pendingSigning,
  }) {
    const applicationBefore = baseline.application || {};
    const applicationAfter = after.application || {};
    requireInvariant('application assessment: resubmit/signing race converges on one canonical RM-review application state', (
      Number(applicationAfter?.id) === Number(applicationId) &&
      Number(applicationAfter?.case_id) === Number(caseId) &&
      Number(applicationAfter?.workflow_id) === Number(applicationBefore?.workflow_id) &&
      applicationAfter?.current_stage === 'rm_review' &&
      applicationAfter?.current_owner_role === 'Regional Manager' &&
      applicationAfter?.status === 'pending_approval' &&
      applicationAfter?.lifecycle_status === 'pending_decision' &&
      applicationAfter?.decision_outcome == null &&
      applicationAfter?.awaiting_reason === 'none' &&
      Number(applicationAfter?.docs_requested_active) === 0 &&
      applicationAfter?.docs_requested_source === 'secure_message' &&
      Number(applicationAfter?.row_version) === Number(applicationBefore?.row_version) + 2
    ), { applicationBefore, applicationAfter });

    const addedWorkflowEvents = rowsAddedById(baseline.workflowEvents, after.workflowEvents);
    requireInvariant('application assessment: resubmit race creates exactly one returned-to-submitter review transition', (
      addedWorkflowEvents.length === 1 &&
      Number(addedWorkflowEvents[0]?.review_workflow_id) === Number(applicationBefore?.workflow_id) &&
      addedWorkflowEvents[0]?.action === 'submit_for_rm_review' &&
      addedWorkflowEvents[0]?.from_stage === 'returned_to_submitter' &&
      addedWorkflowEvents[0]?.to_stage === 'rm_review'
    ), { workflowId: applicationBefore?.workflow_id, addedWorkflowEvents });

    const addedCaseEvents = rowsAddedById(baseline.caseEvents, after.caseEvents);
    const addedCaseEventTypes = addedCaseEvents.map(row => row.event_type).sort();
    const expectedCaseEventTypes = [
      'assessment_submitted',
      'document_request_cleared',
      'document_signed',
      'rm_review_requested',
      'status_changed',
    ].sort();
    requireInvariant('application assessment: resubmit/signing race emits one exact event of each intended type', (
      addedCaseEvents.length === expectedCaseEventTypes.length &&
      json(addedCaseEventTypes) === json(expectedCaseEventTypes)
    ), { addedCaseEvents });

    const addedDocuments = rowsAddedById(baseline.documents, after.documents);
    const addedDocumentCategories = addedDocuments.map(row => row.document_category).sort();
    const expectedDocumentCategories = [
      'application_form',
      'case_assessment',
      'case_assessment_redline',
      'financial_overview',
    ].sort();
    const addedDocumentKeys = addedDocuments.map(row => String(row.file_path || '')).filter(Boolean);
    requireInvariant('application assessment: one resubmit plus one signing creates exactly four scoped durable documents', (
      addedDocuments.length === expectedDocumentCategories.length &&
      json(addedDocumentCategories) === json(expectedDocumentCategories) &&
      addedDocuments.every(row => (
        row.source === 'system_generated' &&
        row.status === 'active' &&
        typeof row.file_path === 'string' && row.file_path.length > 0 &&
        typeof row.checksum_sha256 === 'string' && row.checksum_sha256.length === 64
      )) &&
      new Set(addedDocumentKeys).size === addedDocuments.length
    ), { applicationId, addedDocuments });

    const priorSubmittedAssessmentDocs = (baseline.documents || [])
      .filter(row => row.document_category === 'case_assessment')
      .map(row => ({ row, metadata: parseJsonObject(row.metadata) }))
      .filter(item => Number.isSafeInteger(Number(item.metadata.assessment_version_number)));
    const previousAssessmentVersion = Math.max(
      0,
      ...priorSubmittedAssessmentDocs.map(item => Number(item.metadata.assessment_version_number))
    );
    const newAssessment = addedDocuments.find(row => row.document_category === 'case_assessment') || null;
    const newRedline = addedDocuments.find(row => row.document_category === 'case_assessment_redline') || null;
    const newAssessmentMetadata = parseJsonObject(newAssessment?.metadata);
    const newRedlineMetadata = parseJsonObject(newRedline?.metadata);
    requireInvariant('application assessment: resubmit creates one unique clean/redline assessment version pair', (
      previousAssessmentVersion > 0 &&
      Number(newAssessmentMetadata.assessment_version_number) === previousAssessmentVersion + 1 &&
      newAssessmentMetadata.assessment_variant === 'submitted' &&
      Number(newRedlineMetadata.assessment_version_number) === previousAssessmentVersion + 1 &&
      newRedlineMetadata.assessment_variant === 'redline' &&
      Number(newRedlineMetadata.assessment_previous_version_number) === previousAssessmentVersion
    ), {
      previousAssessmentVersion,
      newAssessment,
      newRedline,
    });

    const baselineActiveApplicationForms = (baseline.documents || []).filter(row => (
      row.document_category === 'application_form' && row.status === 'active'
    ));
    const newApplicationForms = addedDocuments.filter(row => row.document_category === 'application_form');
    const archivedPriorApplicationForms = baselineActiveApplicationForms.map(beforeRow => (
      (after.documents || []).find(afterRow => Number(afterRow.id) === Number(beforeRow.id))
    ));
    requireInvariant('application assessment: exact UI resubmit replaces only the generated application form', (
      baselineActiveApplicationForms.length === 1 &&
      newApplicationForms.length === 1 &&
      archivedPriorApplicationForms.length === 1 &&
      archivedPriorApplicationForms[0]?.status === 'archived'
    ), {
      baselineActiveApplicationForms,
      newApplicationForms,
      archivedPriorApplicationForms,
    });

    const baselineFinancialDocuments = (baseline.documents || []).filter(
      row => row.document_category === 'financial_overview'
    );
    const unchangedFinancialDocuments = baselineFinancialDocuments.every(beforeRow => {
      const afterRow = (after.documents || []).find(row => Number(row.id) === Number(beforeRow.id));
      return afterRow && json(afterRow) === json(beforeRow);
    });
    requireInvariant('application assessment: resubmit preserves every pre-race version-managed Financial Overview row', (
      baselineFinancialDocuments.length > 0 && unchangedFinancialDocuments
    ), { baselineFinancialDocuments });

    const signingBefore = pendingSigning.signingBaseline || null;
    const signingAfter = await captureFinancialOverviewSigningState(
      pendingSigning.signingRequestId,
      pendingSigning.fundingOverviewVersionId
    );
    const signedRequest = signingAfter.signingRequests[0] || null;
    const signedDocument = signingAfter.documents[0] || null;
    const signedVersion = signingAfter.versions[0] || null;
    const signedLink = signingAfter.versionDocuments.find(row => row.document_type === 'signed') || null;
    const signedDocumentMetadata = parseJsonObject(signedDocument?.metadata);
    requireInvariant('application assessment: signing race fulfils only its exact pending Financial Overview version', (
      signingBefore?.signingRequests?.length === 1 &&
      ['pending', 'viewed'].includes(signingBefore.signingRequests[0]?.status) &&
      signingBefore?.documents?.length === 0 &&
      signingBefore?.versions?.length === 1 &&
      signingBefore.versions[0]?.status === 'sent' &&
      signingAfter.signingRequests.length === 1 &&
      signedRequest?.status === 'signed' &&
      signedRequest?.signed_at != null &&
      Number(signedRequest?.case_id) === Number(caseId) &&
      Number(signedRequest?.participant_user_id) === Number(fixture.applicantUser) &&
      typeof signedRequest?.completion_artifact_key === 'string' &&
      signedRequest.completion_artifact_key === signedDocument?.file_path &&
      signedRequest?.completion_claim_token == null &&
      signedRequest?.completion_claim_expires_at == null &&
      signingAfter.documents.length === 1 &&
      Number(signedDocument?.application_id) === Number(applicationId) &&
      Number(signedDocument?.applicant_user_id) === Number(fixture.applicantUser) &&
      Number(signedDocument?.signing_request_id) === Number(pendingSigning.signingRequestId) &&
      signedDocument?.document_category === 'financial_overview' &&
      Number(signedDocumentMetadata.funding_overview_version_id) === Number(pendingSigning.fundingOverviewVersionId) &&
      signingAfter.versions.length === 1 &&
      signedVersion?.status === 'signed' &&
      signedVersion?.signed_at != null &&
      Number(signedVersion?.signed_by_participant_id) === Number(fixture.applicantUser) &&
      Number(signedLink?.funding_overview_version_id) === Number(pendingSigning.fundingOverviewVersionId) &&
      Number(signedLink?.document_id) === Number(signedDocument?.id) &&
      Number(addedDocuments.find(row => row.document_category === 'financial_overview')?.id) === Number(signedDocument?.id)
    ), { signingBefore, signingAfter });

    const addedCurrentObjects = objectEntriesAdded(
      baseline.objectInventory.currentObjects,
      after.objectInventory.currentObjects
    );
    const addedObjectVersions = objectEntriesAdded(
      baseline.objectInventory.versions,
      after.objectInventory.versions
    );
    const expectedKeys = [...addedDocumentKeys].sort();
    const currentKeys = addedCurrentObjects.map(item => item.key).sort();
    const versionKeys = addedObjectVersions.map(item => item.key).sort();
    requireInvariant('application assessment: four new DB documents map one-to-one to four exact S3 object versions', (
      addedCurrentObjects.length === addedDocuments.length &&
      addedObjectVersions.length === addedDocuments.length &&
      addedObjectVersions.every(item => item.kind === 'version' && typeof item.versionId === 'string' && item.versionId.length > 0) &&
      json(currentKeys) === json(expectedKeys) &&
      json(versionKeys) === json(expectedKeys)
    ), {
      expectedKeys,
      addedCurrentObjects,
      addedObjectVersions,
    });

    return {
      applicationRowVersionBefore: Number(applicationBefore.row_version),
      applicationRowVersionAfter: Number(applicationAfter.row_version),
      workflowEventIds: addedWorkflowEvents.map(row => row.id),
      caseEventIds: addedCaseEvents.map(row => row.id),
      caseEventTypes: addedCaseEventTypes,
      documentIds: addedDocuments.map(row => Number(row.id)),
      documentCategories: addedDocumentCategories,
      assessmentVersionNumber: previousAssessmentVersion + 1,
      objectCurrentCount: addedCurrentObjects.length,
      objectVersionCount: addedObjectVersions.length,
    };
  }

  async function getApplicationAssessmentSentinelState(applicationId) {
    const [[row]] = await query(
      `SELECT application_id, case_id, date_of_assessment, overview, employment_goals,
              previous_iset, employment_barriers, local_area_priorities,
              other_funding_details, esdc_eligibility, intervention_start_date,
              intervention_end_date, intervention_budget_pot_id, posting_context,
              intervention_code, intervention_outcome_code, intervention_duration_days,
              intervention_cost_total, institution, program_name, itp_payload,
              wage_payload, recommendation, justification, proposed_interventions,
              childcare_need, created_at, updated_at
         FROM iset_application_assessment
        WHERE application_id = ?
        LIMIT 1`,
      [applicationId]
    );
    return row || null;
  }

  async function getInterventionState(interventionId) {
    const [[interventionRow]] = await query(
      `SELECT id, case_id, action_plan_id, status, delivery_status
         FROM iset_case_intervention
        WHERE id = ?
        LIMIT 1`,
      [interventionId]
    );
    if (!interventionRow) return null;
    const [proposalRows] = await query(
      `SELECT id, proposal_kind, review_status, submitted_at
         FROM iset_intervention_proposal
        WHERE legacy_intervention_id = ?
        ORDER BY id ASC`,
      [interventionId]
    );
    if (proposalRows.length > 1) {
      throw new Error(`Intervention ${interventionId} has multiple compatibility proposals.`);
    }
    const proposalRow = proposalRows[0] || null;
    let workflowRow = null;
    if (proposalRow) {
      const workflowType = proposalRow.proposal_kind === 'revision'
        ? 'intervention_revision'
        : 'intervention_proposal';
      const [workflowRows] = await query(
        `SELECT id, workflow_type, current_stage, current_owner_role, nwac_decision
           FROM iset_review_workflow
          WHERE archived_at IS NULL
            AND workflow_type = ?
            AND proposal_id = ?
          ORDER BY id ASC`,
        [workflowType, proposalRow.id]
      );
      if (workflowRows.length > 1) {
        throw new Error(`Proposal ${proposalRow.id} has multiple active ${workflowType} workflows.`);
      }
      workflowRow = workflowRows[0] || null;
    }
    return {
      ...interventionRow,
      proposal_id: proposalRow?.id || null,
      proposal_kind: proposalRow?.proposal_kind || null,
      review_status: proposalRow?.review_status || null,
      submitted_at: proposalRow?.submitted_at || null,
      workflow_id: workflowRow?.id || null,
      workflow_type: workflowRow?.workflow_type || null,
      current_stage: workflowRow?.current_stage || null,
      current_owner_role: workflowRow?.current_owner_role || null,
      nwac_decision: workflowRow?.nwac_decision || null,
    };
  }

  async function satisfySubmitChecklist(auth, label = 'application') {
    const caseId = fixture.cases[label];
    const applicationId = fixture.applications[label];
    const url = `/api/applicants/${fixture.applicantUser}/document-checklist?applicationId=${applicationId}&stage=submit_assessment`;
    const before = await fetchJson(url, { headers: authHeaders(auth) });
    const missing = (before.items || []).filter(item => item.required !== false && item.status !== 'complete');
    for (const item of missing) {
      const type = Array.isArray(item.documentTypes) && item.documentTypes.length
        ? item.documentTypes[0]
        : item.id;
      const filePath = `/tmp/two-step-review-${config.stamp}-${type}.pdf`;
      makePdf(filePath, `Two-step smoke ${type}`);
      try {
        await uploadDocument(auth, filePath, type, item.label || type, caseId, applicationId);
      } finally {
        fs.rmSync(filePath, { force: true });
      }
    }
    const after = await fetchJson(url, { headers: authHeaders(auth) });
    const stillMissing = (after.items || []).filter(item => item.required !== false && item.status !== 'complete');
    expect('application assessment submit checklist satisfied', stillMissing.length === 0, {
      missingBefore: missing.map(item => item.label || item.id),
      missingAfter: stillMissing.map(item => item.label || item.id),
    });
  }

  function makePdf(filePath, title) {
    fs.writeFileSync(
      filePath,
      Buffer.from(`%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >> endobj\n4 0 obj << /Length ${title.length + 44} >> stream\nBT /F1 12 Tf 20 90 Td (${title}) Tj ET\nendstream endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n`)
    );
  }

  async function uploadDocument(auth, filePath, documentType, label, caseId, applicationId) {
    const form = new FormData();
    const blob = new Blob([fs.readFileSync(filePath)], { type: 'application/pdf' });
    form.append('file', blob, path.basename(filePath));
    form.append('label', label);
    form.append('documentType', documentType);
    form.append('caseId', String(caseId));
    form.append('applicationId', String(applicationId));
    return fetchJson(`/api/applicants/${fixture.applicantUser}/documents/upload`, {
      method: 'POST',
      headers: authHeaders(auth),
      body: form,
    });
  }

  async function runApplicationAssessmentWorkflow(auth) {
    const caseId = fixture.cases.application;
    const applicationId = fixture.applications.application;
    await satisfySubmitChecklist(auth.coordinator);

    let state = await getApplicationState(applicationId);
    await fetchJson(`/api/cases/${caseId}`, {
      method: 'PUT',
      headers: { ...authHeaders(auth.coordinator), 'Content-Type': 'application/json' },
      body: json(completeAssessmentPayload(applicationId, state.row_version, {
        assessment_submit_action: true,
        status: 'intake',
        applicationStatus: 'pending_approval',
      })),
    });
    state = await getApplicationState(applicationId);
    fixture.workflows.application = state.workflow_id;
    expect('application assessment: Coordinator submit moves to RM review', state.current_stage === 'rm_review', state);
    await assertNotification('rm_review_requested', fixture.staff.manager.staffProfileId, { caseId, applicationId });
    await assertRouteText(
      auth.manager,
      `/application-case/${caseId}?applicationId=${applicationId}&entry=approval&approvalType=application&step=decision`,
      ['Review the submitted assessment and either return it with notes or submit it for final decision.'],
      'application assessment RM review'
    );

    const lockedEdit = await fetchExpectingFailure(`/api/cases/${caseId}`, {
      method: 'PUT',
      headers: { ...authHeaders(auth.coordinator), 'Content-Type': 'application/json' },
      body: json({ applicationId, case_summary: 'This edit should be locked during RM review.' }),
    });
    expect('application assessment: submitter body edit is locked at RM review', lockedEdit.status === 409, lockedEdit);

    await fetchJson(`/api/cases/${caseId}/assessment/review-workflow/action`, {
      method: 'POST',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ applicationId, action: 'rm_return_to_submitter', note: 'Please clarify the training rationale.' }),
    });
    state = await getApplicationState(applicationId);
    expect('application assessment: RM return moves to returned_to_submitter', state.current_stage === 'returned_to_submitter' && state.status === 'in_review', state);
    await assertNotification('rm_review_returned_to_submitter', fixture.staff.coordinator.staffProfileId, { caseId, applicationId });

    await fetchJson(`/api/cases/${caseId}`, {
      method: 'PUT',
      headers: { ...authHeaders(auth.coordinator), 'Content-Type': 'application/json' },
      body: json(completeAssessmentPayload(applicationId, state.row_version, {
        assessment_submit_action: true,
        status: 'intake',
        applicationStatus: 'pending_approval',
      })),
    });
    state = await getApplicationState(applicationId);
    expect('application assessment: Coordinator resubmit returns to RM review', state.current_stage === 'rm_review', state);

    await fetchJson(`/api/cases/${caseId}/assessment/review-workflow/action`, {
      method: 'POST',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ applicationId, action: 'rm_submit_to_nwac', note: 'Regional Manager sign-off for final decision.' }),
    });
    state = await getApplicationState(applicationId);
    expect('application assessment: RM submit moves to Decision Maker review', state.current_stage === 'nwac_review', state);
    await assertNotification('rm_review_submitted_to_nwac', null, { caseId, applicationId, audienceRole: 'NWAC Administrator' });
    await assertRouteText(
      auth.decisionMaker,
      `/application-case/${caseId}?applicationId=${applicationId}&entry=approval&approvalType=application&step=decision`,
      ['NWAC approval review', 'Decision Maker', 'Commit'],
      'application assessment Decision Maker review'
    );

    const rmFinalAttempt = await fetchExpectingFailure(`/api/cases/${caseId}`, {
      method: 'PUT',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({
        applicationId,
        assessment_nwac_review_status: 'approve',
        assessment_nwac_review: 'yes',
        assessment_nwac_reason: 'RM must not final approve.',
        applicationStatus: 'approved',
      }),
    });
    expect('application assessment: RM cannot record final decision', rmFinalAttempt.status === 403, rmFinalAttempt);

    await fetchJson(`/api/cases/${caseId}`, {
      method: 'PUT',
      headers: { ...authHeaders(auth.decisionMaker), 'Content-Type': 'application/json' },
      body: json({
        applicationId,
        assessment_nwac_review_status: 'push_back',
        assessment_nwac_reason: 'Please add funding-source detail.',
      }),
    });
    state = await getApplicationState(applicationId);
    expect('application assessment: Decision Maker request changes returns to RM', state.current_stage === 'returned_to_rm', state);
    await assertNotification('nwac_review_changes_requested', fixture.staff.manager.staffProfileId, { caseId, applicationId });

    await fetchJson(`/api/cases/${caseId}/assessment/review-workflow/action`, {
      method: 'POST',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ applicationId, action: 'rm_forward_changes_to_submitter', note: 'Coordinator, please address Decision Maker note.' }),
    });
    state = await getApplicationState(applicationId);
    expect('application assessment: RM forward returns to submitter', state.current_stage === 'returned_to_submitter' && state.status === 'in_review', state);
    await assertNotification('rm_review_changes_forwarded', fixture.staff.coordinator.staffProfileId, { caseId, applicationId });

    await fetchJson(`/api/cases/${caseId}`, {
      method: 'PUT',
      headers: { ...authHeaders(auth.coordinator), 'Content-Type': 'application/json' },
      body: json(completeAssessmentPayload(applicationId, state.row_version, {
        assessment_submit_action: true,
        status: 'intake',
        applicationStatus: 'pending_approval',
      })),
    });
    await fetchJson(`/api/cases/${caseId}/assessment/review-workflow/action`, {
      method: 'POST',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ applicationId, action: 'rm_submit_to_nwac', note: 'Final RM sign-off.' }),
    });
    state = await getApplicationState(applicationId);
    await fetchJson(`/api/cases/${caseId}`, {
      method: 'PUT',
      headers: { ...authHeaders(auth.decisionMaker), 'Content-Type': 'application/json' },
      body: json({
        applicationId,
        assessment_nwac_review_status: 'approve',
        assessment_nwac_review: 'yes',
        assessment_nwac_reason: 'Approved by Decision Maker.',
        assessment_intervention_pot_id: String(config.budgetPotId),
        postingContext: 'external',
        applicationStatus: 'approved',
        status: 'initiated',
      }),
    });
    state = await getApplicationState(applicationId);
    expect('application assessment: final decision recorded by Decision Maker', state.current_stage === 'final_decision_recorded' && state.decision_outcome === 'approved', state);
    await assertGeneratedDocuments({ caseId, applicationId, workflow: 'application_assessment', minCount: 2 });
  }

  async function runDualRoleApplicationAssessmentWorkflow(auth) {
    const caseId = fixture.cases.dualRoleApplication;
    const applicationId = fixture.applications.dualRoleApplication;
    const unaffectedApplicationId = fixture.applications.dualRoleSibling;
    await satisfySubmitChecklist(auth.manager, 'dualRoleApplication');

    let state = await getApplicationState(applicationId);
    await fetchJson(`/api/cases/${caseId}`, {
      method: 'PUT',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json(completeAssessmentPayload(applicationId, state.row_version, {
        assessment_submit_action: true,
        status: 'intake',
        applicationStatus: 'pending_approval',
      })),
    });
    state = await getApplicationState(applicationId);
    fixture.workflows.dualRoleApplication = state.workflow_id;
    expect('application assessment: dual-role RM submits as original submitter', (
      state.current_stage === 'rm_review' &&
      state.status === 'pending_approval' &&
      state.lifecycle_status === 'pending_decision' &&
      Number(state.submitted_by_staff_profile_id) === Number(fixture.staff.manager.staffProfileId)
    ), state);

    const omittedActionScope = await fetchExpectingFailure(
      `/api/cases/${caseId}/assessment/review-workflow/action`,
      {
        method: 'POST',
        headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
        body: json({
          action: 'rm_submit_to_nwac',
          note: 'This deliberately omits application scope.',
        }),
      }
    );
    expect('application assessment: review action fails closed without exact application', (
      omittedActionScope.status === 400 &&
      omittedActionScope.body?.error === 'application_id_required_for_assessment'
    ), omittedActionScope);

    const omittedRecallScope = await fetchExpectingFailure(
      `/api/cases/${caseId}/assessment/recall`,
      {
        method: 'POST',
        headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
        body: json({ expectedApplicationRowVersion: state.row_version }),
      }
    );
    expect('application assessment: recall fails closed without exact application', (
      omittedRecallScope.status === 400 &&
      omittedRecallScope.body?.error === 'application_id_required_for_assessment'
    ), omittedRecallScope);
    const omittedStatusScope = await fetchExpectingFailure(`/api/cases/${caseId}`, {
      method: 'PUT',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ applicationStatus: 'completed' }),
    });
    expect('application assessment: lifecycle update fails closed without exact application', (
      omittedStatusScope.status === 422 &&
      omittedStatusScope.body?.error === 'application_id_required_for_application_mutation'
    ), omittedStatusScope);
    const omittedDocsScope = await fetchExpectingFailure(`/api/cases/${caseId}`, {
      method: 'PUT',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ docsRequested: true }),
    });
    expect('application assessment: document request fails closed without exact application', (
      omittedDocsScope.status === 422 &&
      omittedDocsScope.body?.error === 'application_id_required_for_application_mutation'
    ), omittedDocsScope);
    const afterScopeDenials = await getApplicationState(applicationId);
    expect('application assessment: omitted-scope denials do not mutate either repeat application', (
      afterScopeDenials.current_stage === state.current_stage &&
      Number(afterScopeDenials.row_version) === Number(state.row_version)
    ), { before: state, after: afterScopeDenials });

    await fetchJson(`/api/cases/${caseId}/assessment/review-workflow/action`, {
      method: 'POST',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({
        applicationId,
        action: 'rm_submit_to_nwac',
        note: 'Dual-role Regional Manager sign-off for final decision.',
      }),
    });
    state = await getApplicationState(applicationId);
    expect('application assessment: dual-role RM submission reaches Decision Maker', (
      state.current_stage === 'nwac_review' &&
      state.status === 'pending_approval' &&
      state.lifecycle_status === 'pending_decision'
    ), state);

    await fetchJson(`/api/cases/${caseId}`, {
      method: 'PUT',
      headers: { ...authHeaders(auth.decisionMaker), 'Content-Type': 'application/json' },
      body: json({
        applicationId,
        assessment_nwac_review_status: 'push_back',
        assessment_nwac_reason: 'Please obtain and apply the participant Financial Overview.',
      }),
    });
    state = await getApplicationState(applicationId);
    requireInvariant('application assessment: Decision Maker return preserves the review-state status invariant', (
      state.current_stage === 'returned_to_rm' &&
      state.status === 'pending_approval' &&
      state.lifecycle_status === 'pending_decision' &&
      state.decision_outcome == null &&
      state.awaiting_reason === 'none'
    ), state);

    const futurePrimaryTimestamp = new Date(Date.now() + (24 * 60 * 60 * 1000));
    await query(
      'UPDATE iset_application SET updated_at = ? WHERE id = ? AND case_id = ?',
      [futurePrimaryTimestamp, unaffectedApplicationId, caseId]
    );
    const assertSiblingIsPrimary = async (name) => {
      const [[primaryApplicationRow]] = await query(
        `SELECT id
           FROM iset_application
          WHERE case_id = ?
          ORDER BY updated_at DESC, id DESC
          LIMIT 1`,
        [caseId]
      );
      requireInvariant(name, (
        Number(primaryApplicationRow?.id) === Number(unaffectedApplicationId) &&
        Number(primaryApplicationRow?.id) !== Number(applicationId)
      ), { applicationId, unaffectedApplicationId, primaryApplicationId: primaryApplicationRow?.id || null });
    };
    await assertSiblingIsPrimary(
      'application assessment: Financial Overview request starts on a proven non-primary repeat application'
    );
    const unaffectedBefore = await getApplicationState(unaffectedApplicationId);
    requireInvariant('application assessment: sibling application baseline is readable before Financial Overview signing', (
      Number(unaffectedBefore?.id) === Number(unaffectedApplicationId)
    ), { unaffectedApplicationId, unaffectedBefore });
    const unaffectedApplicationSentinelBefore = await getApplicationSentinelState(unaffectedApplicationId);
    requireInvariant('application assessment: sibling application row sentinel is complete before correction journey', (
      Number(unaffectedApplicationSentinelBefore?.id) === Number(unaffectedApplicationId) &&
      Number(unaffectedApplicationSentinelBefore?.case_id) === Number(caseId)
    ), { unaffectedApplicationId, unaffectedApplicationSentinelBefore });
    const unaffectedAssessmentBefore = await getApplicationAssessmentSentinelState(unaffectedApplicationId);
    requireInvariant('application assessment: sibling application-assessment sentinel is present before correction journey', (
      Number(unaffectedAssessmentBefore?.application_id) === Number(unaffectedApplicationId) &&
      Number(unaffectedAssessmentBefore?.case_id) === Number(caseId) &&
      unaffectedAssessmentBefore?.overview === fixture.assessmentSentinels.dualRoleSibling
    ), { unaffectedApplicationId, unaffectedAssessmentBefore });

    const initialSigning = await requestAndSignFinancialOverview(
      auth.manager,
      caseId,
      applicationId,
      unaffectedApplicationId,
      {
        beforeSign: async () => {
          const [legacyMismatchUpdate] = await query(
            `UPDATE iset_application
                SET status = 'in_review',
                    lifecycle_status = 'awaiting_applicant',
                    awaiting_reason = 'documents'
              WHERE id = ?
                AND status = 'pending_approval'
                AND lifecycle_status = 'pending_decision'`,
            [applicationId]
          );
          requireInvariant('application assessment: legacy Amanda state reproduced on exact TEST fixture', (
            Number(legacyMismatchUpdate?.affectedRows) === 1
          ), { applicationId, affectedRows: legacyMismatchUpdate?.affectedRows });
          const mismatchState = await getApplicationState(applicationId);
          requireInvariant('application assessment: legacy status mismatch retains authoritative returned-to-RM workflow', (
            mismatchState?.current_stage === 'returned_to_rm' &&
            mismatchState?.status === 'in_review' &&
            mismatchState?.lifecycle_status === 'awaiting_applicant'
          ), mismatchState || {});
          await assertReturnedApplicationInRmQueue(
            auth.manager,
            caseId,
            applicationId,
            unaffectedApplicationId
          );
          await assertReturnedToRmPolicyDenials(auth.manager, caseId, applicationId);
          await clickForwardChangesThroughBrowser(
            auth.manager,
            caseId,
            applicationId,
            { performAction: false }
          );
        },
        concurrentRmForward: {
          auth: auth.manager,
          caseId,
          applicationId,
        },
      }
    );
    state = await getApplicationState(applicationId);
    requireInvariant('application assessment: signing plus concurrent RM forward produces the exact submitter-edit state', (
      state.current_stage === 'returned_to_submitter' &&
      state.status === 'in_review' &&
      state.lifecycle_status === 'in_review' &&
      Number(state.docs_requested_active) === 0 &&
      state.docs_requested_source === 'secure_message' &&
      Number(state.submitted_by_staff_profile_id) === Number(fixture.staff.manager.staffProfileId)
    ), state || {});
    pass('application assessment: deployed UI recovers legacy mismatch to exact submitter-edit state', state);
    await assertSiblingIsPrimary(
      'application assessment: Financial Overview signing preserves the proven non-primary target'
    );
    await assertSiblingIsPrimary(
      'application assessment: Amanda recovery remains scoped to the non-primary application after RM forward'
    );
    await assertNotification('rm_review_changes_forwarded', fixture.staff.manager.staffProfileId, { caseId, applicationId });

    const revisedOverview = await assertReturnedAssessmentEditableAndSave(
      auth.manager,
      caseId,
      applicationId
    );
    const persistedAfterBrowserSave = await getApplicationAssessmentBodyState(applicationId);
    expect('application assessment: deployed browser edit is durably persisted on exact assessment row', (
      Number(persistedAfterBrowserSave?.application_id) === Number(applicationId) &&
      Number(persistedAfterBrowserSave?.case_id) === Number(caseId) &&
      persistedAfterBrowserSave?.overview === revisedOverview
    ), { applicationId, caseId, persistedAfterBrowserSave });
    const pendingSigning = await requestPendingFinancialOverviewForResubmitRace(
      auth.manager,
      caseId,
      applicationId
    );
    pendingSigning.serializedPayload = initialSigning.serializedPayload;
    pendingSigning.cookieHeader = initialSigning.cookieHeader;
    pendingSigning.signingBaseline = await captureFinancialOverviewSigningState(
      pendingSigning.signingRequestId,
      pendingSigning.fundingOverviewVersionId
    );
    const resubmitBaseline = await captureReturnedAssessmentResubmitState(
      caseId,
      applicationId,
      state.workflow_id
    );
    requireInvariant('application assessment: resubmit race baseline is the exact returned assessment and pending signing version', (
      resubmitBaseline?.application?.current_stage === 'returned_to_submitter' &&
      Number(resubmitBaseline?.application?.docs_requested_active) === 1 &&
      pendingSigning.signingBaseline?.signingRequests?.length === 1 &&
      pendingSigning.signingBaseline.signingRequests[0]?.status === 'pending' &&
      pendingSigning.signingBaseline?.documents?.length === 0 &&
      pendingSigning.signingBaseline?.versions?.length === 1 &&
      pendingSigning.signingBaseline.versions[0]?.status === 'sent'
    ), {
      application: resubmitBaseline?.application || null,
      signingRequestId: pendingSigning.signingRequestId,
      fundingOverviewVersionId: pendingSigning.fundingOverviewVersionId,
      signingBaseline: pendingSigning.signingBaseline,
    });
    await resubmitReturnedAssessmentThroughBrowser(auth.manager, caseId, applicationId, {
      baseline: resubmitBaseline,
      pendingSigning,
    });
    state = await getApplicationState(applicationId);
    expect('application assessment: dual-role RM resubmits corrected assessment to own RM review queue', (
      state.current_stage === 'rm_review' &&
      state.status === 'pending_approval' &&
      state.lifecycle_status === 'pending_decision' &&
      Number(state.submitted_by_staff_profile_id) === Number(fixture.staff.manager.staffProfileId)
    ), state);

    await submitCorrectedAssessmentForFinalDecisionThroughBrowser(
      auth.manager,
      caseId,
      applicationId
    );
    state = await getApplicationState(applicationId);
    expect('application assessment: corrected dual-role assessment returns to Decision Maker with canonical state', (
      state.current_stage === 'nwac_review' &&
      state.status === 'pending_approval' &&
      state.lifecycle_status === 'pending_decision' &&
      state.decision_outcome == null &&
      state.awaiting_reason === 'none'
    ), state);
    await assertDecisionMakerQueueAndOpen(
      auth.decisionMaker,
      caseId,
      applicationId,
      unaffectedApplicationId
    );

    const unaffectedAfter = await getApplicationState(unaffectedApplicationId);
    const unaffectedApplicationSentinelAfter = await getApplicationSentinelState(unaffectedApplicationId);
    const unaffectedAssessmentAfter = await getApplicationAssessmentSentinelState(unaffectedApplicationId);
    const unaffectedRemindersAfter = reminderFingerprint(
      await getReminderRows(fixture.reminders.dualRoleSibling || [])
    );
    expect('application assessment: exact dual-role journey leaves other synthetic application unchanged', (
      unaffectedAfter.id === unaffectedBefore.id &&
      unaffectedAfter.status === unaffectedBefore.status &&
      unaffectedAfter.lifecycle_status === unaffectedBefore.lifecycle_status &&
      unaffectedAfter.current_stage === unaffectedBefore.current_stage &&
      Number(unaffectedAfter.row_version) === Number(unaffectedBefore.row_version)
    ), { unaffectedBefore, unaffectedAfter });
    requireInvariant('application assessment: exact dual-role journey leaves sibling application row byte-for-byte unchanged', (
      json(unaffectedApplicationSentinelAfter) === json(unaffectedApplicationSentinelBefore)
    ), {
      applicationBefore: unaffectedApplicationSentinelBefore,
      applicationAfter: unaffectedApplicationSentinelAfter,
    });
    requireInvariant('application assessment: exact dual-role journey leaves sibling application-assessment row byte-for-byte unchanged', (
      json(unaffectedAssessmentAfter) === json(unaffectedAssessmentBefore) &&
      unaffectedAssessmentAfter?.overview === fixture.assessmentSentinels.dualRoleSibling
    ), { unaffectedAssessmentBefore, unaffectedAssessmentAfter });
    requireInvariant('application assessment: exact dual-role journey leaves sibling reminders byte-for-byte unchanged', (
      json(unaffectedRemindersAfter) === json(fixture.reminderSentinels.dualRoleSibling || [])
    ), {
      remindersBefore: fixture.reminderSentinels.dualRoleSibling || [],
      remindersAfter: unaffectedRemindersAfter,
    });
  }

  function interventionSubmitPayload(title, overrides = {}) {
    return {
      code: '3',
      title,
      status: 'submitted',
      startDate: smokeDates.proposalStart,
      endDate: smokeDates.proposalEnd,
      durationDays: 30,
      cost: '100',
      notes: 'Synthetic two-step review intervention.',
      metadata: {
        ...fixture.marker,
        title,
        rationale: 'Synthetic intervention proposal rationale.',
        proposedInterventions: [
          {
            id: `two-step-intervention-${fixture.suffix}`,
            code: '3',
            startDate: smokeDates.proposalStart,
            endDate: smokeDates.proposalEnd,
            deliveryMode: 'partner',
            institution: 'Smoke College',
            programName: title,
            itpDetails: 'Synthetic plan.',
            costLines: [{ id: 'tuition', label: 'Tuition', paymentType: 'tuition', payeeType: 'institution', payeeName: 'Smoke College', amount: '100' }],
          },
        ],
        review: { eiStatus: 'CRF', decision: '', decisionNotes: '' },
      },
      ...overrides,
    };
  }

  async function runInterventionProposalWorkflow(auth) {
    const planId = fixture.actionPlans.proposal;
    const caseId = fixture.cases.proposal;
    const nwacStartAttempt = await fetchExpectingFailure(`/api/action-plans/${planId}/interventions`, {
      method: 'POST',
      headers: { ...authHeaders(auth.decisionMaker), 'Content-Type': 'application/json' },
      body: json(interventionSubmitPayload('NWAC forbidden proposal start')),
    });
    expect('intervention proposal: NWAC Administrator cannot start review', nwacStartAttempt.status === 403, nwacStartAttempt);

    const rmPlanId = fixture.actionPlans.rmProposal;
    const rmStart = await fetchJson(`/api/action-plans/${rmPlanId}/interventions`, {
      method: 'POST',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json(interventionSubmitPayload('RM-started proposal smoke')),
    });
    const rmStartState = await getInterventionState(rmStart.id);
    fixture.interventions.rmProposal = rmStart.id;
    fixture.proposals.rmProposal = rmStartState.proposal_id;
    fixture.workflows.rmProposal = rmStartState.workflow_id;
    expect('intervention proposal: Regional Manager can start own draft review', rmStartState.current_stage === 'rm_review', rmStartState);

    const created = await fetchJson(`/api/action-plans/${planId}/interventions`, {
      method: 'POST',
      headers: { ...authHeaders(auth.coordinator), 'Content-Type': 'application/json' },
      body: json(interventionSubmitPayload('Coordinator proposal smoke')),
    });
    fixture.interventions.proposal = created.id;
    let state = await getInterventionState(created.id);
    fixture.proposals.proposal = state.proposal_id;
    fixture.workflows.proposal = state.workflow_id;
    expect('intervention proposal: Coordinator submit moves to RM review', state.current_stage === 'rm_review' && state.workflow_type === 'intervention_proposal', state);
    await assertNotification('rm_review_requested', fixture.staff.manager.staffProfileId, { caseId, interventionId: created.id });
    await assertRouteText(
      auth.manager,
      `/cases/${caseId}?entry=approval&approvalType=intervention&interventionId=${created.id}&planId=${planId}`,
      ['Regional Manager', 'Submit to NWAC approval', 'Submit for final decision', 'Return'],
      'intervention proposal RM review'
    );

    const lockedEdit = await fetchExpectingFailure(`/api/interventions/${created.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(auth.coordinator), 'Content-Type': 'application/json' },
      body: json({ title: 'This edit should be locked during RM review.' }),
    });
    expect('intervention proposal: submitter body edit is locked at RM review', lockedEdit.status === 409, lockedEdit);

    await fetchJson(`/api/interventions/${created.id}/review-workflow/action`, {
      method: 'POST',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ action: 'rm_return_to_submitter', note: 'Please clarify proposed intervention.' }),
    });
    state = await getInterventionState(created.id);
    expect('intervention proposal: RM return moves to returned_to_submitter', state.current_stage === 'returned_to_submitter' && state.status === 'changes_requested', state);

    await fetchJson(`/api/interventions/${created.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(auth.coordinator), 'Content-Type': 'application/json' },
      body: json(interventionSubmitPayload('Coordinator proposal smoke resubmitted', { status: 'submitted' })),
    });
    state = await getInterventionState(created.id);
    expect('intervention proposal: resubmit returns to RM review', state.current_stage === 'rm_review', state);

    await fetchJson(`/api/interventions/${created.id}/review-workflow/action`, {
      method: 'POST',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ action: 'rm_submit_to_nwac', note: 'RM sign-off for proposal.' }),
    });
    state = await getInterventionState(created.id);
    expect('intervention proposal: RM submit moves to Decision Maker review', state.current_stage === 'nwac_review', state);
    await assertNotification('rm_review_submitted_to_nwac', null, { caseId, interventionId: created.id, audienceRole: 'NWAC Administrator' });

    const rmDecisionAttempt = await fetchExpectingFailure(`/api/interventions/${created.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ status: 'approved', approvedAmount: '100', potId: String(config.budgetPotId), metadata: { review: { decisionNotes: 'RM must not approve.' } } }),
    });
    expect('intervention proposal: RM cannot record final decision', rmDecisionAttempt.status === 403, rmDecisionAttempt);

    await fetchJson(`/api/interventions/${created.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(auth.decisionMaker), 'Content-Type': 'application/json' },
      body: json({ status: 'changes_requested', metadata: { review: { decisionNotes: 'Please add clearer need.' } } }),
    });
    state = await getInterventionState(created.id);
    expect('intervention proposal: Decision Maker request changes returns to RM', state.current_stage === 'returned_to_rm', state);
    await assertNotification('nwac_review_changes_requested', fixture.staff.manager.staffProfileId, { caseId, interventionId: created.id });

    await fetchJson(`/api/interventions/${created.id}/review-workflow/action`, {
      method: 'POST',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ action: 'rm_forward_changes_to_submitter', note: 'Coordinator, please address Decision Maker note.' }),
    });
    state = await getInterventionState(created.id);
    expect('intervention proposal: RM forward returns to submitter', state.current_stage === 'returned_to_submitter', state);
    await assertNotification('rm_review_changes_forwarded', fixture.staff.coordinator.staffProfileId, { caseId, interventionId: created.id });

    await fetchJson(`/api/interventions/${created.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(auth.coordinator), 'Content-Type': 'application/json' },
      body: json(interventionSubmitPayload('Coordinator proposal smoke final resubmit', { status: 'submitted' })),
    });
    await fetchJson(`/api/interventions/${created.id}/review-workflow/action`, {
      method: 'POST',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ action: 'rm_submit_to_nwac', note: 'Final RM proposal sign-off.' }),
    });
    await fetchJson(`/api/interventions/${created.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(auth.decisionMaker), 'Content-Type': 'application/json' },
      body: json({
        status: 'approved',
        approvedAmount: '100',
        potId: String(config.budgetPotId),
        metadata: { review: { decisionNotes: 'Approved proposal.' } },
      }),
    });
    state = await getInterventionState(created.id);
    expect('intervention proposal: final decision recorded by Decision Maker', state.current_stage === 'final_decision_recorded' && state.status === 'approved', state);
    await assertGeneratedDocuments({ caseId, interventionId: created.id, workflow: 'intervention_proposal', minCount: 2, requireInterventionLink: true });
  }

  async function runInterventionRevisionWorkflow(auth) {
    const caseId = fixture.cases.revision;
    const planId = fixture.actionPlans.revision;
    const sourceId = fixture.interventions.revisionSource;
    const draft = await fetchJson(`/api/interventions/${sourceId}/revise`, {
      method: 'POST',
      headers: { ...authHeaders(auth.coordinator), 'Content-Type': 'application/json' },
      body: json({}),
    });
    fixture.interventions.revisionDraft = draft.id;

    const nwacStartAttempt = await fetchExpectingFailure(`/api/interventions/${draft.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(auth.decisionMaker), 'Content-Type': 'application/json' },
      body: json({ status: 'submitted' }),
    });
    expect('intervention revision: NWAC Administrator cannot start review', nwacStartAttempt.status === 403, nwacStartAttempt);

    await fetchJson(`/api/interventions/${draft.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(auth.coordinator), 'Content-Type': 'application/json' },
      body: json({
        status: 'submitted',
        title: 'Coordinator revision smoke',
        startDate: smokeDates.revisionStart,
        endDate: smokeDates.revisionEnd,
        durationDays: 31,
        cost: '100',
        metadata: {
          ...fixture.marker,
          review: { eiStatus: 'CRF', decisionNotes: '' },
          proposedInterventions: [
            {
              id: `two-step-revision-${fixture.suffix}`,
              code: '3',
              startDate: smokeDates.revisionStart,
              endDate: smokeDates.revisionEnd,
              programName: 'Revised smoke plan',
              costLines: [{ id: 'tuition', label: 'Tuition', paymentType: 'tuition', payeeType: 'institution', payeeName: 'Smoke College', amount: '100' }],
            },
          ],
        },
      }),
    });
    let state = await getInterventionState(draft.id);
    fixture.proposals.revision = state.proposal_id;
    fixture.workflows.revision = state.workflow_id;
    expect('intervention revision: Coordinator submit moves to RM review', state.current_stage === 'rm_review' && state.workflow_type === 'intervention_revision', state);
    await assertGeneratedDocuments({ caseId, interventionId: draft.id, workflow: 'intervention_revision_submitted', minCount: 1, requireInterventionLink: true });
    await assertRouteText(
      auth.manager,
      `/cases/${caseId}?entry=approval&approvalType=intervention&interventionId=${draft.id}&planId=${planId}`,
      ['Regional Manager', 'revision', 'Submit to NWAC approval', 'Submit for final decision'],
      'intervention revision RM review'
    );

    await fetchJson(`/api/interventions/${draft.id}/review-workflow/action`, {
      method: 'POST',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ action: 'rm_submit_to_nwac', note: 'RM sign-off for revision.' }),
    });
    state = await getInterventionState(draft.id);
    expect('intervention revision: RM submit moves to Decision Maker review', state.current_stage === 'nwac_review', state);

    await fetchJson(`/api/interventions/${sourceId}`, {
      method: 'PATCH',
      headers: { ...authHeaders(auth.decisionMaker), 'Content-Type': 'application/json' },
      body: json({
        revisionAppliedFromInterventionId: draft.id,
        metadata: { review: { decisionNotes: 'Approved revision.' } },
      }),
    });
    state = await getInterventionState(draft.id);
    expect('intervention revision: final decision recorded by Decision Maker', state.current_stage === 'final_decision_recorded', state);
    await assertGeneratedDocuments({ caseId, interventionId: sourceId, workflow: 'intervention_revision_final_source', minCount: 1, requireInterventionLink: true });
  }

  async function assertNotification(eventKey, audienceStaffProfileId, {
    caseId = null,
    applicationId = null,
    interventionId = null,
    audienceRole = null,
  } = {}) {
    const filters = ['event_key = ?'];
    const params = [eventKey];
    if (audienceStaffProfileId) {
      filters.push('audience_staff_profile_id = ?');
      params.push(audienceStaffProfileId);
    }
    if (audienceRole) {
      filters.push("audience_type = 'role'", 'audience_role = ?');
      params.push(audienceRole);
    }
    if (caseId) {
      filters.push("(CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.caseId')) AS UNSIGNED) = ? OR CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.case_id')) AS UNSIGNED) = ?)");
      params.push(caseId, caseId);
    }
    if (applicationId) {
      filters.push("(CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.applicationId')) AS UNSIGNED) = ? OR CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.application_id')) AS UNSIGNED) = ?)");
      params.push(applicationId, applicationId);
    }
    if (interventionId) {
      filters.push("(CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.interventionId')) AS UNSIGNED) = ? OR CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.intervention_id')) AS UNSIGNED) = ?)");
      params.push(interventionId, interventionId);
    }
    let rows = [];
    for (let attempt = 0; attempt < config.notificationWaitAttempts; attempt += 1) {
      [rows] = await query(
        `SELECT id, event_key, title, audience_type, audience_role, audience_staff_profile_id, metadata
           FROM iset_internal_notification
          WHERE ${filters.join(' AND ')}
          ORDER BY id DESC
          LIMIT 5`,
        params
      );
      if (rows.length) break;
      if (attempt < config.notificationWaitAttempts - 1) await delay(1000);
    }
    const [eventRows] = await query(
      `SELECT id, event_type, subject_type, subject_id, source,
              notification_delivery_mode, captured_at
         FROM iset_event_entry
        WHERE event_type = ?
          AND subject_type = 'case'
          AND subject_id = ?
        ORDER BY captured_at DESC
        LIMIT 5`,
      [eventKey, String(caseId)]
    );
    let deliveryRows = [];
    const eventIds = eventRows.map(row => row.id).filter(Boolean);
    if (eventIds.length) {
      const placeholders = eventIds.map(() => '?').join(',');
      [deliveryRows] = await query(
        `SELECT id, event_id, channel, audience_key, worker_scope, status,
                attempt_count, last_error, last_attempt_at, delivered_at
           FROM iset_event_delivery
          WHERE event_id IN (${placeholders})
          ORDER BY id`,
        eventIds
      );
    }
    const audienceLabel = audienceRole || `staff ${audienceStaffProfileId}`;
    expect(`notification ${eventKey} routed to ${audienceLabel}`, rows.length > 0, {
      caseId,
      applicationId,
      interventionId,
      events: eventRows,
      deliveries: deliveryRows,
      rows: rows.map(row => ({
        id: row.id,
        title: row.title,
        audienceType: row.audience_type,
        audienceRole: row.audience_role,
        audienceStaffProfileId: row.audience_staff_profile_id,
      })),
    });
  }

  async function assertGeneratedDocuments({ caseId, applicationId = null, interventionId = null, workflow, minCount = 1, requireInterventionLink = false }) {
    const params = [caseId];
    const where = ['case_id = ?', "source = 'system_generated'", "status = 'active'"];
    if (applicationId) {
      where.push("(application_id = ? OR CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.application_id')) AS UNSIGNED) = ?)");
      params.push(applicationId, applicationId);
    }
    let linkedDocumentIds = [];
    if (interventionId) {
      const [linkRows] = await query(
        `SELECT document_id
           FROM iset_document_intervention
          WHERE intervention_id = ?
          ORDER BY document_id ASC`,
        [interventionId]
      );
      linkedDocumentIds = linkRows.map(row => Number(row.document_id)).filter(Boolean);
      if (linkedDocumentIds.length) {
        where.push(`(id IN (${linkedDocumentIds.map(() => '?').join(',')}) OR CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.intervention_id')) AS UNSIGNED) = ?)`);
        params.push(...linkedDocumentIds, interventionId);
      } else {
        where.push("CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.intervention_id')) AS UNSIGNED) = ?");
        params.push(interventionId);
      }
    }
    const [rows] = await query(
      `SELECT id, file_path, document_category, metadata
         FROM iset_document
        WHERE ${where.join(' AND ')}
        ORDER BY id`,
      params
    );
    rows.forEach(row => {
      if (row.file_path) fixture.documents.push(row.file_path);
    });
    const linkedIdSet = new Set(linkedDocumentIds);
    const linkOk = !requireInterventionLink || rows.some(row => linkedIdSet.has(Number(row.id)));
    expect(`generated documents present for ${workflow}`, rows.length >= minCount && linkOk, {
      caseId,
      applicationId,
      interventionId,
      count: rows.length,
      linkOk,
      documentIds: rows.map(row => row.id),
      categories: rows.map(row => row.document_category),
    });
  }

  async function verifyNoKnownFixtureMismatches() {
    const caseIds = Object.values(fixture.cases).filter(Boolean);
    if (!caseIds.length) return;
    const placeholders = caseIds.map(() => '?').join(',');
    const [badStages] = await query(
      `SELECT id, workflow_type, current_stage
         FROM iset_review_workflow
        WHERE case_id IN (${placeholders})
          AND current_stage NOT IN ('rm_review','returned_to_submitter','nwac_review','returned_to_rm','final_decision_recorded','withdrawn')`,
      caseIds
    );
    expect('fixture workflows have only valid two-step stages', badStages.length === 0, { badStages });
    const [documentRows] = await query(
      `SELECT id, file_path, JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.intervention_id')) AS \`metadata_intervention_id\`
         FROM iset_document
        WHERE case_id IN (${placeholders})
          AND status = 'active'
          AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.intervention_id')) IS NOT NULL`,
      caseIds
    );
    const documentIds = documentRows.map(row => Number(row.id)).filter(Boolean);
    let linkRows = [];
    if (documentIds.length) {
      [linkRows] = await query(
        `SELECT document_id, intervention_id
           FROM iset_document_intervention
          WHERE document_id IN (${documentIds.map(() => '?').join(',')})`,
        documentIds
      );
    }
    const linkPairs = new Set(linkRows.map(row => `${Number(row.document_id)}:${Number(row.intervention_id)}`));
    const missingLinks = documentRows.filter(row => (
      !linkPairs.has(`${Number(row.id)}:${Number(row.metadata_intervention_id)}`)
    ));
    expect('fixture generated intervention documents have normalized links', missingLinks.length === 0, { missingLinks });
    expect('browser run had no serious console/page/API errors', result.browserIssues.length === 0, {
      browserIssues: result.browserIssues.slice(0, 10),
    });
  }

  async function cleanupFixture(options = {}) {
    progress('cleanup starting');
    const stampLike = `%${config.stamp}%`;
    const staffEmails = config.staffUsers.map(user => user.email);
    try {
      await collectFixtureDocumentPaths(stampLike);

      const [caseRows] = await query(
        `SELECT id FROM iset_case WHERE CAST(case_context_json AS CHAR) LIKE ?`,
        [stampLike]
      );
      const caseIds = Array.from(new Set([
        ...Object.values(fixture.cases).filter(Boolean),
        ...caseRows.map(row => Number(row.id)).filter(Boolean),
      ]));
      const signingRequestIds = await idsWhereIn('signing_request', 'case_id', caseIds);
      if (signingRequestIds.length) {
        const [signingArtifactRows] = await query(
          `SELECT completion_artifact_key, artifact_url
             FROM signing_request
            WHERE id IN (${signingRequestIds.map(() => '?').join(',')})`,
          signingRequestIds
        );
        signingArtifactRows.forEach(row => {
          if (row.completion_artifact_key) fixture.documents.push(row.completion_artifact_key);
          if (row.artifact_url) fixture.documents.push(row.artifact_url);
        });
      }
      const [applicationRows] = await query(
        `SELECT id FROM iset_application WHERE CAST(payload_json AS CHAR) LIKE ?`,
        [stampLike]
      );
      const applicationIds = Array.from(new Set([
        ...Object.values(fixture.applications).filter(Boolean),
        ...applicationRows.map(row => Number(row.id)).filter(Boolean),
      ]));
      const [actionPlanRows] = caseIds.length
        ? await query(
            `SELECT id FROM iset_case_action_plan WHERE case_id IN (${caseIds.map(() => '?').join(',')})`,
            caseIds
          )
        : [[]];
      const actionPlanIds = Array.from(new Set([
        ...Object.values(fixture.actionPlans).filter(Boolean),
        ...actionPlanRows.map(row => Number(row.id)).filter(Boolean),
      ]));
      const [interventionRows] = caseIds.length
        ? await query(
            `SELECT id FROM iset_case_intervention WHERE case_id IN (${caseIds.map(() => '?').join(',')})`,
            caseIds
          )
        : [[]];
      const interventionIds = Array.from(new Set([
        ...Object.values(fixture.interventions).filter(Boolean),
        ...interventionRows.map(row => Number(row.id)).filter(Boolean),
      ]));
      const [proposalRows] = interventionIds.length
        ? await query(`SELECT id FROM iset_intervention_proposal WHERE legacy_intervention_id IN (${interventionIds.map(() => '?').join(',')})`, interventionIds)
        : [[]];
      const proposalIds = Array.from(new Set([
        ...Object.values(fixture.proposals).filter(Boolean),
        ...proposalRows.map(row => Number(row.id)).filter(Boolean),
      ]));
      const [staffRows] = staffEmails.length
        ? await query(`SELECT id FROM staff_profiles WHERE email IN (${staffEmails.map(() => '?').join(',')})`, staffEmails)
        : [[]];
      const staffProfileIds = Array.from(new Set([
        ...Object.values(fixture.staff).map(row => row.staffProfileId).filter(Boolean),
        ...staffRows.map(row => Number(row.id)).filter(Boolean),
      ]));
      const [userRows] = await query(
        `SELECT id FROM user WHERE email LIKE ? OR cognito_sub LIKE ? ${staffEmails.length ? `OR email IN (${staffEmails.map(() => '?').join(',')})` : ''}`,
        [`codex.twostep.${fixture.suffix}%`, `two-step-applicant-${fixture.suffix}%`, ...staffEmails]
      );
      const userIds = Array.from(new Set([
        fixture.applicantUser,
        ...Object.values(fixture.staff).map(row => row.staffUserId).filter(Boolean),
        ...userRows.map(row => Number(row.id)).filter(Boolean),
      ].filter(Boolean)));
      const cognitoSubjects = Array.from(new Set([
        config.applicantUser?.sub,
        ...config.staffUsers.map(user => user.sub),
      ].filter(Boolean)));
      const eventIds = await idsForFixtureEvents(caseIds, staffProfileIds, fixture.applicantUser, stampLike);
      const reminderIds = await idsWhereIn('iset_case_reminder', 'case_id', caseIds);
      if (userIds.length) {
        const [pendingObjectRows] = await query(
          `SELECT object_key FROM pending_uploads WHERE user_id IN (${userIds.map(() => '?').join(',')})`,
          userIds
        );
        pendingObjectRows.forEach(row => {
          if (row.object_key) fixture.documents.push(row.object_key);
        });
      }
      fixture.documents = Array.from(new Set(fixture.documents.filter(Boolean)));
      await deleteFixtureObjects({ userIds });

      await deleteWhereIn('iset_document_intervention', 'document_id', await idsForDocuments(caseIds, stampLike));
      if (interventionIds.length) await deleteWhereIn('iset_document_intervention', 'intervention_id', interventionIds);
      await deleteWhereIn('iset_event_delivery', 'event_id', eventIds);
      await deleteWhereIn('iset_event_receipt', 'event_id', eventIds);
      await deleteWhereIn('iset_event_receipt', 'viewer_staff_profile_id', staffProfileIds);
      await deleteWhereIn('iset_event_receipt', 'viewer_applicant_user_id', [fixture.applicantUser].filter(Boolean));
      await deleteWhereIn('iset_reminder_lifecycle_event', 'reminder_id', reminderIds);
      if (staffProfileIds.length) await deleteWhereIn('iset_internal_notification', 'audience_staff_profile_id', staffProfileIds);
      if (fixture.applicantUser) await deleteWhereIn('iset_internal_notification', 'audience_applicant_user_id', [fixture.applicantUser]);
      if (caseIds.length) {
        const placeholders = caseIds.map(() => '?').join(',');
        await query(
          `DELETE FROM iset_internal_notification
            WHERE CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.caseId')) AS UNSIGNED) IN (${placeholders})
               OR CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.case_id')) AS UNSIGNED) IN (${placeholders})`,
          [...caseIds, ...caseIds]
        );
      }
      await deleteWhereLike('iset_internal_notification', 'metadata', stampLike);
      if (caseIds.length) {
        const subjectPlaceholders = caseIds.map(() => '?').join(',');
        await query(
          `DELETE FROM iset_event_entry
            WHERE subject_type = 'case'
              AND subject_id IN (${subjectPlaceholders})`,
          caseIds.map(String)
        );
      }
      if (staffProfileIds.length) await deleteWhereIn('iset_event_entry', 'actor_staff_profile_id', staffProfileIds);
      if (fixture.applicantUser) await deleteWhereIn('iset_event_entry', 'actor_applicant_user_id', [fixture.applicantUser]);
      if (caseIds.length) {
        const placeholders = caseIds.map(() => '?').join(',');
        await query(
          `DELETE FROM iset_event_entry
            WHERE CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.caseId')) AS UNSIGNED) IN (${placeholders})
               OR CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.case_id')) AS UNSIGNED) IN (${placeholders})`,
          [...caseIds, ...caseIds]
        );
      }
      await deleteWhereLike('iset_event_entry', 'payload_json', stampLike);
      await deleteWhereIn('iset_case_note', 'case_id', caseIds);
      await deleteWhereIn('iset_case_conflict_declaration', 'case_id', caseIds);
      await deleteWorkflowRows(caseIds, applicationIds, interventionIds, proposalIds);
      await deleteWhereIn('application_lock', 'application_id', applicationIds);
      const documentIds = await idsForDocuments(caseIds, stampLike);
      const agreementIds = await deleteGeneratedAgreementRows(caseIds, documentIds);
      await deleteWhereIn('iset_document', 'id', documentIds);
      const messageIds = await idsWhereIn('messages', 'case_id', caseIds);
      const esdcParticipantSubmissionIds = await idsWhereIn('esdc_participant_submission', 'case_id', caseIds);
      await deleteWhereIn('message_attachment', 'message_id', messageIds);
      await deleteWhereIn('message_item', 'message_id', messageIds);
      await deleteWhereIn('message_signing_request', 'message_id', messageIds);
      await deleteWhereIn('message_signing_request', 'signing_request_id', signingRequestIds);
      await deleteWhereIn('signing_request', 'id', signingRequestIds);
      await deleteWhereIn('messages', 'id', messageIds);
      await deleteWhereIn('iset_case_reminder', 'case_id', caseIds);
      await deleteWhereIn(
        'esdc_participant_submission_history',
        'participant_submission_id',
        esdcParticipantSubmissionIds
      );
      await deleteWhereIn('esdc_participant_submission', 'case_id', caseIds);
      await deleteWhereIn('iset_intervention_proposal', 'id', proposalIds);
      await deleteWhereIn('iset_case_intervention', 'id', interventionIds);
      await deleteWhereIn('iset_case_action_plan', 'id', actionPlanIds);
      await deleteWhereIn('iset_application_assessment', 'application_id', applicationIds);
      await deleteWhereIn('iset_application', 'id', applicationIds);
      await deleteWhereIn('iset_application_submission', 'id', Object.values(fixture.submissions).filter(Boolean));
      await deleteWhereIn('iset_case', 'id', caseIds);
      if (fixture.client) await deleteWhereIn('client', 'id', [fixture.client]);
      await query('DELETE FROM client WHERE address_json IS NOT NULL AND CAST(address_json AS CHAR) LIKE ?', [stampLike]);
      await deleteWhereIn('staff_region', 'staff_profile_id', staffProfileIds);
      await deleteWhereIn('staff_profiles', 'id', staffProfileIds);
      await deleteWhereIn('input_json_state', 'user_id', userIds);
      await deleteWhereIn('iset_application_draft_dynamic', 'user_id', userIds);
      await deleteWhereIn('pending_uploads', 'user_id', userIds);
      await deleteWhereIn('user_session_audit', 'user_id', cognitoSubjects);
      await deleteWhereIn('user', 'id', userIds);

      const leftovers = await countFixtureLeftovers(stampLike, staffEmails, {
        caseIds,
        applicationIds,
        actionPlanIds,
        interventionIds,
        proposalIds,
        staffProfileIds,
        userIds,
        cognitoSubjects,
        eventIds,
        reminderIds,
        documentIds,
        messageIds,
        signingRequestIds,
        esdcParticipantSubmissionIds,
        agreementIds,
      });
      const cleanupIsComplete = Object.values(leftovers).every(count => count === 0);
      if (!options.quiet) {
        result.cleanup = leftovers;
        expect('TEST synthetic fixture cleaned up', cleanupIsComplete, leftovers);
      }
      if (!cleanupIsComplete) {
        const residueError = new Error('test_fixture_cleanup_residue');
        residueError.leftovers = leftovers;
        throw residueError;
      }
      progress('cleanup complete');
    } catch (error) {
      if (!options.quiet) fail('TEST synthetic fixture cleaned up', { error: error.message || String(error) });
      progress(`cleanup failed: ${error.message || String(error)}`);
      throw error;
    }
  }

  async function idsForFixtureEvents(caseIds, staffProfileIds, applicantUserId, stampLike) {
    const clauses = ['CAST(payload_json AS CHAR) LIKE ?'];
    const params = [stampLike];
    if (caseIds.length) {
      const placeholders = caseIds.map(() => '?').join(',');
      clauses.push(`(subject_type = 'case' AND subject_id IN (${placeholders}))`);
      params.push(...caseIds.map(String));
      clauses.push(`CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.caseId')) AS UNSIGNED) IN (${placeholders})`);
      params.push(...caseIds);
      clauses.push(`CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.case_id')) AS UNSIGNED) IN (${placeholders})`);
      params.push(...caseIds);
    }
    if (staffProfileIds.length) {
      clauses.push(`actor_staff_profile_id IN (${staffProfileIds.map(() => '?').join(',')})`);
      params.push(...staffProfileIds);
    }
    if (applicantUserId) {
      clauses.push('actor_applicant_user_id = ?');
      params.push(applicantUserId);
    }
    const [rows] = await query(
      `SELECT id
         FROM iset_event_entry
        WHERE ${clauses.join(' OR ')}`,
      params
    );
    return Array.from(new Set(rows.map(row => String(row.id || '')).filter(Boolean)));
  }

  async function collectFixtureDocumentPaths(stampLike) {
    const caseIds = Object.values(fixture.cases).filter(Boolean);
    const params = [stampLike];
    const clauses = ['CAST(metadata AS CHAR) LIKE ?'];
    if (caseIds.length) {
      clauses.push(`case_id IN (${caseIds.map(() => '?').join(',')})`);
      params.push(...caseIds);
    }
    const [rows] = await query(
      `SELECT file_path FROM iset_document WHERE ${clauses.join(' OR ')}`,
      params
    );
    rows.forEach(row => {
      if (row.file_path) fixture.documents.push(row.file_path);
    });
    fixture.documents = Array.from(new Set(fixture.documents.filter(Boolean)));
  }

  function buildFixtureObjectPrefixes(options = {}) {
    const explicitUserIds = Array.isArray(options.userIds) ? options.userIds : null;
    const fixtureUserIds = Array.from(new Set(
      (explicitUserIds || [
        fixture.applicantUser,
        ...Object.values(fixture.staff).map(row => row?.staffUserId),
      ])
        .map(value => Number(value))
        .filter(value => Number.isSafeInteger(value) && value > 0)
    )).sort((left, right) => left - right);
    if (!fixtureUserIds.length) {
      if (options.allowEmpty === true) return [];
      throw new Error('fixture_object_prefix_user_identity_missing');
    }
    if (options.requireComplete !== false) {
      const expectedUserCount = 1 + config.staffUsers.length;
      if (
        !Number.isSafeInteger(Number(fixture.applicantUser)) ||
        Number(fixture.applicantUser) <= 0 ||
        fixtureUserIds.length !== expectedUserCount
      ) {
        throw new Error('fixture_object_prefix_user_identity_incomplete');
      }
    }
    const basePrefix = String(process.env.OBJECT_KEY_PREFIX || 'uploads/')
      .replace(/^\/+|\/+$/g, '') || 'uploads';
    const dates = new Set();
    const addDate = value => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) throw new Error('fixture_object_prefix_date_invalid');
      dates.add([
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0'),
      ].join('/'));
    };
    addDate(result.startedAt);
    addDate(new Date());
    addDate(new Date(Date.now() - (24 * 60 * 60 * 1000)));
    addDate(new Date(Date.now() + (24 * 60 * 60 * 1000)));
    return fixtureUserIds.flatMap(userId => ([
      `${basePrefix}/signed-forms/${userId}/`,
      ...Array.from(dates).sort().map(datePath => `${basePrefix}/${datePath}/${userId}/`),
    ]));
  }

  function execRemoteAwsJson(args) {
    if (!result.evidence?.awsTarget?.independentlyVerifiedRemoteIdentity?.arn) {
      throw new Error('fixture_s3_remote_identity_not_verified');
    }
    const { execFileSync } = require('child_process');
    const output = execFileSync('aws', [...args, '--output', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60_000,
    }).trim();
    return output ? JSON.parse(output) : {};
  }

  function listFixturePrefixInventory(options = {}) {
    const bucket = String(process.env.OBJECT_BUCKET || '').trim();
    if (bucket !== config.expectedObjectBucket) {
      throw new Error(`object_bucket_identity_mismatch:${bucket || 'missing'}`);
    }
    const region = process.env.OBJECT_REGION || process.env.AWS_REGION || 'ca-central-1';
    const prefixes = fixture.objectPrefixes.length
      ? fixture.objectPrefixes
      : buildFixtureObjectPrefixes(options);
    fixture.objectPrefixes = Array.from(new Set(prefixes)).sort();
    const currentObjects = [];
    const versions = [];
    for (const prefix of fixture.objectPrefixes) {
      const current = execRemoteAwsJson([
        's3api', 'list-objects-v2', '--bucket', bucket, '--prefix', prefix, '--region', region,
      ]);
      if (current.IsTruncated === true) {
        throw new Error(`fixture_object_inventory_truncated:${prefix}`);
      }
      for (const item of current.Contents || []) {
        if (!String(item?.Key || '').startsWith(prefix)) throw new Error(`fixture_object_prefix_escape:${item?.Key}`);
        currentObjects.push({
          key: item.Key,
          size: Number(item.Size || 0),
          etag: item.ETag || null,
          lastModified: item.LastModified || null,
        });
      }
      const versioned = execRemoteAwsJson([
        's3api', 'list-object-versions', '--bucket', bucket, '--prefix', prefix, '--region', region,
      ]);
      if (versioned.IsTruncated === true) {
        throw new Error(`fixture_object_version_inventory_truncated:${prefix}`);
      }
      for (const [kind, items] of [
        ['version', versioned.Versions || []],
        ['delete-marker', versioned.DeleteMarkers || []],
      ]) {
        for (const item of items) {
          if (!String(item?.Key || '').startsWith(prefix)) throw new Error(`fixture_object_version_prefix_escape:${item?.Key}`);
          if (typeof item?.VersionId !== 'string' || !item.VersionId) {
            throw new Error(`fixture_object_version_id_missing:${item?.Key}`);
          }
          versions.push({
            key: item.Key,
            versionId: item.VersionId,
            kind,
            isLatest: item.IsLatest === true,
            size: Number(item.Size || 0),
            etag: item.ETag || null,
            lastModified: item.LastModified || null,
          });
        }
      }
    }
    const sortKey = item => `${item.key}\u0000${item.versionId || ''}\u0000${item.kind || 'current'}`;
    currentObjects.sort((left, right) => sortKey(left).localeCompare(sortKey(right)));
    versions.sort((left, right) => sortKey(left).localeCompare(sortKey(right)));
    return {
      bucket,
      region,
      prefixes: [...fixture.objectPrefixes],
      currentObjects,
      versions,
    };
  }

  async function proveFixtureObjectPrefixBaseline() {
    fixture.objectPrefixes = buildFixtureObjectPrefixes();
    const baseline = listFixturePrefixInventory();
    requireInvariant('TEST synthetic fixture owns empty exact S3 prefixes before uploads', (
      baseline.currentObjects.length === 0 && baseline.versions.length === 0
    ), baseline);
    result.evidence.objectStorage = {
      independentlyVerifiedRemoteIdentity: result.evidence.awsTarget.independentlyVerifiedRemoteIdentity,
      bucket: baseline.bucket,
      region: baseline.region,
      exactFixturePrefixes: baseline.prefixes,
      baselineCurrentObjectCount: 0,
      baselineVersionCount: 0,
    };
  }

  async function deleteFixtureObjects(options = {}) {
    const bucket = String(process.env.OBJECT_BUCKET || '').trim();
    if (bucket !== config.expectedObjectBucket) {
      throw new Error(`object_bucket_identity_mismatch:${bucket || 'missing'}`);
    }
    const region = process.env.OBJECT_REGION || process.env.AWS_REGION || 'ca-central-1';
    const resolveObjectKey = value => {
      const raw = String(value || '').trim();
      if (!raw) return null;
      if (raw.startsWith('s3://')) {
        const withoutScheme = raw.slice(5);
        const slash = withoutScheme.indexOf('/');
        const objectBucket = slash >= 0 ? withoutScheme.slice(0, slash) : withoutScheme;
        if (objectBucket !== bucket) throw new Error(`fixture_object_bucket_mismatch:${objectBucket}`);
        return slash >= 0 ? withoutScheme.slice(slash + 1) : null;
      }
      if (/^https?:\/\//i.test(raw)) {
        const parsed = new URL(raw);
        const hostname = parsed.hostname.toLowerCase();
        if (hostname.startsWith(`${bucket.toLowerCase()}.s3.`)) {
          return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
        }
        if (/^s3[.-]/.test(hostname)) {
          const pathParts = parsed.pathname.replace(/^\//, '').split('/');
          if (pathParts.shift() !== bucket) throw new Error(`fixture_object_bucket_mismatch:${raw}`);
          return decodeURIComponent(pathParts.join('/'));
        }
        throw new Error(`fixture_object_url_unverified:${raw}`);
      }
      return raw.replace(/^\//, '');
    };
    const prefixInventory = listFixturePrefixInventory({
      userIds: options.userIds,
      allowEmpty: true,
      requireComplete: false,
    });
    const discoveredPrefixKeys = [
      ...prefixInventory.currentObjects.map(item => item.key),
      ...prefixInventory.versions.map(item => item.key),
    ];
    const keys = Array.from(new Set([
      ...fixture.documents.map(resolveObjectKey).filter(Boolean),
      ...discoveredPrefixKeys,
    ])).sort();
    for (const key of keys) {
      if (!fixture.objectPrefixes.some(prefix => key.startsWith(prefix))) {
        throw new Error(`fixture_object_outside_verified_prefix:${key}`);
      }
    }
    fixture.expectedObjectKeys = Array.from(new Set([
      ...fixture.expectedObjectKeys,
      ...keys,
    ])).sort();
    for (const item of prefixInventory.versions) {
      execRemoteAwsJson([
        's3api', 'delete-object', '--bucket', bucket, '--key', item.key,
        '--version-id', item.versionId, '--region', region,
      ]);
      fixture.deletedObjectVersions.push({
        key: item.key,
        versionId: item.versionId,
        kind: item.kind,
      });
    }
    const keysWithVersions = new Set(prefixInventory.versions.map(item => item.key));
    for (const item of prefixInventory.currentObjects) {
      if (keysWithVersions.has(item.key)) continue;
      const deleted = execRemoteAwsJson([
        's3api', 'delete-object', '--bucket', bucket, '--key', item.key, '--region', region,
      ]);
      fixture.deletedObjectVersions.push({
        key: item.key,
        versionId: deleted.VersionId || deleted.DeleteMarkerVersionId || null,
        kind: 'current-unversioned',
      });
    }
    const finalInventory = listFixturePrefixInventory({
      userIds: options.userIds,
      allowEmpty: true,
      requireComplete: false,
    });
    if (finalInventory.currentObjects.length || finalInventory.versions.length) {
      throw new Error(`fixture_object_prefix_residue:${json(finalInventory)}`);
    }
    const { execFileSync } = require('child_process');
    for (const key of keys) {
      let absent = false;
      try {
        execFileSync('aws', ['s3api', 'head-object', '--bucket', bucket, '--key', key, '--region', region], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          maxBuffer: 1024 * 1024,
        });
      } catch (error) {
        const message = String(error.stderr || error.message || error);
        if (/Not Found|404|NoSuchKey/i.test(message)) absent = true;
        else throw error;
      }
      if (!absent) throw new Error(`fixture_object_still_exists:s3://${bucket}/${key}`);
      fixture.deletedObjects.push(key);
      fixture.verifiedAbsentObjectKeys.push(key);
    }
    fixture.verifiedAbsentObjectKeys = Array.from(new Set(fixture.verifiedAbsentObjectKeys));
    result.evidence.objectCleanup = {
      bucket,
      region,
      exactFixturePrefixes: [...fixture.objectPrefixes],
      discoveredBeforeCleanup: prefixInventory,
      deletedKeys: Array.from(new Set(fixture.deletedObjects)).sort(),
      deletedKeyVersions: fixture.deletedObjectVersions
        .map(item => ({ ...item }))
        .sort((left, right) => `${left.key}:${left.versionId || ''}`.localeCompare(`${right.key}:${right.versionId || ''}`)),
      verifiedAbsentKeys: [...fixture.verifiedAbsentObjectKeys].sort(),
      finalCurrentObjectCount: 0,
      finalVersionOrDeleteMarkerCount: 0,
    };
  }

  async function idsForDocuments(caseIds, stampLike) {
    const params = [stampLike];
    const clauses = ['CAST(metadata AS CHAR) LIKE ?'];
    if (caseIds.length) {
      clauses.push(`case_id IN (${caseIds.map(() => '?').join(',')})`);
      params.push(...caseIds);
    }
    const [rows] = await query(`SELECT id FROM iset_document WHERE ${clauses.join(' OR ')}`, params);
    return rows.map(row => Number(row.id)).filter(Boolean);
  }

  async function deleteWorkflowRows(caseIds, applicationIds, interventionIds, proposalIds) {
    const clauses = [];
    const params = [];
    if (caseIds.length) {
      clauses.push(`case_id IN (${caseIds.map(() => '?').join(',')})`);
      params.push(...caseIds);
    }
    if (applicationIds.length) {
      clauses.push(`application_id IN (${applicationIds.map(() => '?').join(',')})`);
      params.push(...applicationIds);
    }
    if (interventionIds.length) {
      clauses.push(`intervention_id IN (${interventionIds.map(() => '?').join(',')})`);
      params.push(...interventionIds);
    }
    if (proposalIds.length) {
      clauses.push(`proposal_id IN (${proposalIds.map(() => '?').join(',')})`);
      params.push(...proposalIds);
    }
    if (!clauses.length) return;
    const [rows] = await query(`SELECT id FROM iset_review_workflow WHERE ${clauses.join(' OR ')}`, params);
    const workflowIds = rows.map(row => Number(row.id)).filter(Boolean);
    await deleteWhereIn('iset_review_workflow_event', 'review_workflow_id', workflowIds);
    await deleteWhereIn('iset_review_workflow', 'id', workflowIds);
  }

  async function deleteGeneratedAgreementRows(caseIds, documentIds) {
    await deleteWhereIn('cfa_version_documents', 'document_id', documentIds);
    await deleteWhereIn('funding_overview_version_documents', 'document_id', documentIds);

    const cfaSeriesIds = await idsWhereIn('cfa_series', 'case_id', caseIds);
    const cfaVersionIds = await idsWhereIn('cfa_version', 'series_id', cfaSeriesIds);
    await deleteWhereIn('cfa_version_documents', 'cfa_version_id', cfaVersionIds);
    await deleteWhereIn('cfa_version', 'id', cfaVersionIds);
    await deleteWhereIn('cfa_series', 'id', cfaSeriesIds);

    const fundingSeriesIds = await idsWhereIn('funding_overview_series', 'case_id', caseIds);
    const fundingVersionIds = await idsWhereIn('funding_overview_version', 'series_id', fundingSeriesIds);
    await deleteWhereIn('funding_overview_version_documents', 'funding_overview_version_id', fundingVersionIds);
    await deleteWhereIn('funding_overview_version', 'id', fundingVersionIds);
    await deleteWhereIn('funding_overview_series', 'id', fundingSeriesIds);
    return {
      cfaSeriesIds,
      cfaVersionIds,
      fundingSeriesIds,
      fundingVersionIds,
    };
  }

  async function idsWhereIn(table, column, values) {
    const filtered = (values || []).filter(value => value !== null && typeof value !== 'undefined');
    if (!filtered.length) return [];
    const key = `${table}.${column}`;
    if (!CLEANUP_ID_LOOKUP_ALLOWLIST.has(key)) throw new Error(`cleanup_id_lookup_not_allowed:${key}`);
    const [rows] = await query(
      `SELECT id FROM ${table} WHERE ${column} IN (${filtered.map(() => '?').join(',')})`,
      filtered
    );
    return rows.map(row => Number(row.id)).filter(Boolean);
  }

  async function deleteWhereIn(table, column, values) {
    const filtered = (values || []).filter(value => value !== null && typeof value !== 'undefined');
    if (!filtered.length) return;
    const key = `${table}.${column}`;
    if (!CLEANUP_DELETE_ALLOWLIST.has(key)) throw new Error(`cleanup_delete_not_allowed:${key}`);
    const sql = `DELETE FROM ${table} WHERE ${column} IN (${filtered.map(() => '?').join(',')})`;
    await query(sql, filtered);
  }

  async function deleteWhereLike(table, column, value) {
    const key = `${table}.${column}`;
    if (!CLEANUP_LIKE_ALLOWLIST.has(key)) throw new Error(`cleanup_like_not_allowed:${key}`);
    await query(`DELETE FROM ${table} WHERE CAST(${column} AS CHAR) LIKE ?`, [value]);
  }

  async function countFixtureLeftovers(stampLike, staffEmails, scope = {}) {
    const counts = {
      eventDeliveries: 0,
      eventReceipts: 0,
      eventReceiptsByFixtureViewer: 0,
      reminderLifecycleEvents: 0,
      userSessionAudit: 0,
    };
    const [[caseCount]] = await query('SELECT COUNT(*) AS `count` FROM iset_case WHERE case_context_json IS NOT NULL AND CAST(case_context_json AS CHAR) LIKE ?', [stampLike]);
    counts.cases = Number(caseCount.count || 0);
    const [[appCount]] = await query('SELECT COUNT(*) AS `count` FROM iset_application WHERE payload_json IS NOT NULL AND CAST(payload_json AS CHAR) LIKE ?', [stampLike]);
    counts.applications = Number(appCount.count || 0);
    const [[interventionCount]] = await query('SELECT COUNT(*) AS `count` FROM iset_case_intervention WHERE metadata_json IS NOT NULL AND CAST(metadata_json AS CHAR) LIKE ?', [stampLike]);
    counts.interventions = Number(interventionCount.count || 0);
    const [[docCount]] = await query('SELECT COUNT(*) AS `count` FROM iset_document WHERE metadata IS NOT NULL AND CAST(metadata AS CHAR) LIKE ?', [stampLike]);
    counts.documents = Number(docCount.count || 0);
    const [[notificationCount]] = await query('SELECT COUNT(*) AS `count` FROM iset_internal_notification WHERE metadata IS NOT NULL AND CAST(metadata AS CHAR) LIKE ?', [stampLike]);
    counts.notifications = Number(notificationCount.count || 0);
    const caseIds = Array.from(new Set(scope.caseIds || Object.values(fixture.cases).filter(Boolean)));
    if (caseIds.length) {
      const placeholders = caseIds.map(() => '?').join(',');
      const [[messageCount]] = await query(`SELECT COUNT(*) AS \`count\` FROM messages WHERE case_id IN (${placeholders})`, caseIds);
      counts.messages = Number(messageCount.count || 0);
      const [[signingRequestCount]] = await query(`SELECT COUNT(*) AS \`count\` FROM signing_request WHERE case_id IN (${placeholders})`, caseIds);
      counts.signingRequests = Number(signingRequestCount.count || 0);
      const [[reminderCount]] = await query(`SELECT COUNT(*) AS \`count\` FROM iset_case_reminder WHERE case_id IN (${placeholders})`, caseIds);
      counts.reminders = Number(reminderCount.count || 0);
      const [[caseEventCount]] = await query(
        `SELECT COUNT(*) AS \`count\`
           FROM iset_event_entry
          WHERE (subject_type = 'case' AND subject_id IN (${placeholders}))
             OR CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.caseId')) AS UNSIGNED) IN (${placeholders})
             OR CAST(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.case_id')) AS UNSIGNED) IN (${placeholders})`,
        [...caseIds.map(String), ...caseIds, ...caseIds]
      );
      counts.caseEvents = Number(caseEventCount.count || 0);
      const [conflictDeclarationRows] = await query(
        `SELECT id FROM iset_case_conflict_declaration WHERE case_id IN (${placeholders})`,
        caseIds
      );
      counts.conflictDeclarations = conflictDeclarationRows.length;
      const [[caseNotificationCount]] = await query(
        `SELECT COUNT(*) AS \`count\`
           FROM iset_internal_notification
          WHERE CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.caseId')) AS UNSIGNED) IN (${placeholders})
             OR CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.case_id')) AS UNSIGNED) IN (${placeholders})`,
        [...caseIds, ...caseIds]
      );
      counts.caseNotifications = Number(caseNotificationCount.count || 0);
      const fundingSeriesIds = await idsWhereIn('funding_overview_series', 'case_id', caseIds);
      const fundingVersionIds = await idsWhereIn('funding_overview_version', 'series_id', fundingSeriesIds);
      counts.fundingOverviewVersions = fundingVersionIds.length;
      const [[actionPlanCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM iset_case_action_plan WHERE case_id IN (${placeholders})`,
        caseIds
      );
      counts.actionPlans = Number(actionPlanCount.count || 0);
      const [[scopedInterventionCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM iset_case_intervention WHERE case_id IN (${placeholders})`,
        caseIds
      );
      counts.caseInterventions = Number(scopedInterventionCount.count || 0);
      const [[esdcSubmissionCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM esdc_participant_submission WHERE case_id IN (${placeholders})`,
        caseIds
      );
      counts.esdcParticipantSubmissions = Number(esdcSubmissionCount.count || 0);
      const [[reviewWorkflowCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM iset_review_workflow WHERE case_id IN (${placeholders})`,
        caseIds
      );
      counts.reviewWorkflows = Number(reviewWorkflowCount.count || 0);
      const [[documentCaseCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM iset_document WHERE case_id IN (${placeholders})`,
        caseIds
      );
      counts.caseDocuments = Number(documentCaseCount.count || 0);
      const [[cfaSeriesCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM cfa_series WHERE case_id IN (${placeholders})`,
        caseIds
      );
      counts.cfaSeries = Number(cfaSeriesCount.count || 0);
      const [[fundingSeriesCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM funding_overview_series WHERE case_id IN (${placeholders})`,
        caseIds
      );
      counts.fundingOverviewSeries = Number(fundingSeriesCount.count || 0);
    }
    const applicationIds = Array.from(new Set(scope.applicationIds || []));
    if (applicationIds.length) {
      const placeholders = applicationIds.map(() => '?').join(',');
      const [[applicationIdCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM iset_application WHERE id IN (${placeholders})`,
        applicationIds
      );
      counts.applicationIds = Number(applicationIdCount.count || 0);
      const [[assessmentCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM iset_application_assessment WHERE application_id IN (${placeholders})`,
        applicationIds
      );
      counts.applicationAssessments = Number(assessmentCount.count || 0);
    }
    const eventIds = Array.from(new Set(scope.eventIds || []));
    if (eventIds.length) {
      const placeholders = eventIds.map(() => '?').join(',');
      const [[deliveryCount]] = await query(
        `SELECT COUNT(*) FROM iset_event_delivery WHERE event_id IN (${placeholders})`,
        eventIds
      );
      counts.eventDeliveries = Number(deliveryCount['COUNT(*)'] || 0);
      const [[receiptCount]] = await query(
        `SELECT COUNT(*) FROM iset_event_receipt WHERE event_id IN (${placeholders})`,
        eventIds
      );
      counts.eventReceipts = Number(receiptCount['COUNT(*)'] || 0);
    }
    const reminderIds = Array.from(new Set(scope.reminderIds || []));
    if (reminderIds.length) {
      const placeholders = reminderIds.map(() => '?').join(',');
      const [[reminderLifecycleCount]] = await query(
        `SELECT COUNT(*) FROM iset_reminder_lifecycle_event WHERE reminder_id IN (${placeholders})`,
        reminderIds
      );
      counts.reminderLifecycleEvents = Number(reminderLifecycleCount['COUNT(*)'] || 0);
    }
    const submissionIds = Object.values(fixture.submissions).filter(Boolean);
    if (submissionIds.length) {
      const placeholders = submissionIds.map(() => '?').join(',');
      const [[submissionCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM iset_application_submission WHERE id IN (${placeholders})`,
        submissionIds
      );
      counts.applicationSubmissions = Number(submissionCount.count || 0);
    }
    const proposalIds = Array.from(new Set(scope.proposalIds || []));
    if (proposalIds.length) {
      const placeholders = proposalIds.map(() => '?').join(',');
      const [[proposalCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM iset_intervention_proposal WHERE id IN (${placeholders})`,
        proposalIds
      );
      counts.interventionProposals = Number(proposalCount.count || 0);
    }
    const messageIds = Array.from(new Set(scope.messageIds || []));
    if (messageIds.length) {
      const placeholders = messageIds.map(() => '?').join(',');
      const [[messageItemCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM message_item WHERE message_id IN (${placeholders})`,
        messageIds
      );
      counts.messageItems = Number(messageItemCount.count || 0);
      const [[messageSigningLinkCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM message_signing_request WHERE message_id IN (${placeholders})`,
        messageIds
      );
      counts.messageSigningLinks = Number(messageSigningLinkCount.count || 0);
      const [[messageAttachmentCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM message_attachment WHERE message_id IN (${placeholders})`,
        messageIds
      );
      counts.messageAttachments = Number(messageAttachmentCount.count || 0);
    }
    const signingRequestIds = Array.from(new Set(scope.signingRequestIds || []));
    if (signingRequestIds.length) {
      const placeholders = signingRequestIds.map(() => '?').join(',');
      const [[signingCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM signing_request WHERE id IN (${placeholders})`,
        signingRequestIds
      );
      counts.signingRequestIds = Number(signingCount.count || 0);
      const [[signingLinkCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM message_signing_request WHERE signing_request_id IN (${placeholders})`,
        signingRequestIds
      );
      counts.signingRequestLinks = Number(signingLinkCount.count || 0);
    }
    const esdcParticipantSubmissionIds = Array.from(new Set(scope.esdcParticipantSubmissionIds || []));
    if (esdcParticipantSubmissionIds.length) {
      const placeholders = esdcParticipantSubmissionIds.map(() => '?').join(',');
      const [[esdcHistoryCount]] = await query(
        `SELECT COUNT(*) AS \`count\`
           FROM esdc_participant_submission_history
          WHERE participant_submission_id IN (${placeholders})`,
        esdcParticipantSubmissionIds
      );
      counts.esdcParticipantSubmissionHistory = Number(esdcHistoryCount.count || 0);
    }
    const documentIds = Array.from(new Set(scope.documentIds || []));
    if (documentIds.length) {
      const placeholders = documentIds.map(() => '?').join(',');
      const [[documentIdCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM iset_document WHERE id IN (${placeholders})`,
        documentIds
      );
      counts.documentIds = Number(documentIdCount.count || 0);
      const [[documentLinkCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM iset_document_intervention WHERE document_id IN (${placeholders})`,
        documentIds
      );
      counts.documentInterventionLinks = Number(documentLinkCount.count || 0);
    }
    const cfaVersionIds = Array.from(new Set(scope.agreementIds?.cfaVersionIds || []));
    if (cfaVersionIds.length) {
      const placeholders = cfaVersionIds.map(() => '?').join(',');
      const [[cfaVersionCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM cfa_version WHERE id IN (${placeholders})`,
        cfaVersionIds
      );
      counts.cfaVersions = Number(cfaVersionCount.count || 0);
    }
    const fundingVersionIds = Array.from(new Set(scope.agreementIds?.fundingVersionIds || []));
    if (fundingVersionIds.length) {
      const placeholders = fundingVersionIds.map(() => '?').join(',');
      const [[fundingVersionCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM funding_overview_version WHERE id IN (${placeholders})`,
        fundingVersionIds
      );
      counts.fundingOverviewVersionIds = Number(fundingVersionCount.count || 0);
    }
    if (staffEmails.length) {
      const [[staffCount]] = await query(`SELECT COUNT(*) AS \`count\` FROM staff_profiles WHERE email IN (${staffEmails.map(() => '?').join(',')})`, staffEmails);
      counts.staffProfiles = Number(staffCount.count || 0);
      const [[userCount]] = await query(`SELECT COUNT(*) AS \`count\` FROM user WHERE email IN (${staffEmails.map(() => '?').join(',')}) OR email LIKE ?`, [...staffEmails, `codex.twostep.${fixture.suffix}%`]);
      counts.users = Number(userCount.count || 0);
    }
    const userIds = Array.from(new Set(scope.userIds || []));
    if (userIds.length) {
      const placeholders = userIds.map(() => '?').join(',');
      const [[pendingUploadCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM pending_uploads WHERE user_id IN (${placeholders})`,
        userIds
      );
      counts.pendingUploads = Number(pendingUploadCount.count || 0);
      const [[inputStateCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM input_json_state WHERE user_id IN (${placeholders})`,
        userIds
      );
      counts.inputJsonState = Number(inputStateCount.count || 0);
      const [[draftCount]] = await query(
        `SELECT COUNT(*) AS \`count\` FROM iset_application_draft_dynamic WHERE user_id IN (${placeholders})`,
        userIds
      );
      counts.applicationDrafts = Number(draftCount.count || 0);
    }
    const staffProfileIds = Array.from(new Set(scope.staffProfileIds || []));
    if (staffProfileIds.length || userIds.length) {
      const receiptClauses = [];
      const receiptParams = [];
      if (staffProfileIds.length) {
        receiptClauses.push(`viewer_staff_profile_id IN (${staffProfileIds.map(() => '?').join(',')})`);
        receiptParams.push(...staffProfileIds);
      }
      if (userIds.length) {
        receiptClauses.push(`viewer_applicant_user_id IN (${userIds.map(() => '?').join(',')})`);
        receiptParams.push(...userIds);
      }
      const [[viewerReceiptCount]] = await query(
        `SELECT COUNT(*) FROM iset_event_receipt WHERE ${receiptClauses.join(' OR ')}`,
        receiptParams
      );
      counts.eventReceiptsByFixtureViewer = Number(viewerReceiptCount['COUNT(*)'] || 0);
    }
    const cognitoSubjects = Array.from(new Set(scope.cognitoSubjects || []));
    if (cognitoSubjects.length) {
      const placeholders = cognitoSubjects.map(() => '?').join(',');
      const [[sessionAuditCount]] = await query(
        `SELECT COUNT(*) FROM user_session_audit WHERE user_id IN (${placeholders})`,
        cognitoSubjects
      );
      counts.userSessionAudit = Number(sessionAuditCount['COUNT(*)'] || 0);
    }
    const verifiedAbsentObjectKeys = new Set(fixture.verifiedAbsentObjectKeys || []);
    counts.objectStorageResidue = (fixture.expectedObjectKeys || []).filter(
      key => !verifiedAbsentObjectKeys.has(key)
    ).length;
    return counts;
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message || error);
    process.exit(1);
  });
}

module.exports = {
  createEncryptedFixtureEnvelope,
  createLiveSchemaGuard,
};
