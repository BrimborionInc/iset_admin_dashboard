#!/usr/bin/env node

const readline = require('readline');

const TARGET_TABLE = 'iset_case_conflict_declaration';
const GENERATED_COLUMN = 'is_active';
const TARGET_COLUMNS_WITHOUT_GENERATED = [
  '`id`',
  '`case_id`',
  '`staff_profile_id`',
  '`declaration_choice`',
  '`conflict_details`',
  '`signed_at`',
  '`signed_ip`',
  '`signed_user_agent`',
  '`revoked_at`',
  '`revoked_reason`',
];

function splitSqlList(text) {
  const items = [];
  let current = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (inString) {
      current += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === "'") {
        inString = false;
      }
      continue;
    }
    if (ch === "'") {
      inString = true;
      current += ch;
      continue;
    }
    if (ch === ',') {
      items.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  items.push(current);
  return items;
}

function findTupleEnd(text, startIndex) {
  let inString = false;
  let escaped = false;
  let depth = 0;

  for (let index = startIndex; index < text.length; index += 1) {
    const ch = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === "'") {
        inString = false;
      }
      continue;
    }
    if (ch === "'") {
      inString = true;
      continue;
    }
    if (ch === '(') {
      depth += 1;
      continue;
    }
    if (ch === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function removeValueFromTuple(tupleText, valueIndex) {
  if (!tupleText.startsWith('(') || !tupleText.endsWith(')')) {
    return tupleText;
  }
  const values = splitSqlList(tupleText.slice(1, -1));
  if (valueIndex < 0 || valueIndex >= values.length) {
    return tupleText;
  }
  values.splice(valueIndex, 1);
  return `(${values.join(',')})`;
}

function sanitizeValues(valuesText, valueIndex) {
  let output = '';
  let index = 0;

  while (index < valuesText.length) {
    const ch = valuesText[index];
    if (ch !== '(') {
      output += ch;
      index += 1;
      continue;
    }
    const end = findTupleEnd(valuesText, index);
    if (end === -1) {
      output += valuesText.slice(index);
      break;
    }
    output += removeValueFromTuple(valuesText.slice(index, end + 1), valueIndex);
    index = end + 1;
  }

  return output;
}

function parseColumnList(prefix) {
  const open = prefix.indexOf('(');
  const close = prefix.lastIndexOf(')');
  if (open === -1 || close === -1 || close <= open) return null;
  return {
    before: prefix.slice(0, open + 1),
    columns: prefix.slice(open + 1, close),
    after: prefix.slice(close),
  };
}

function sanitizeInsertLine(line) {
  const tablePattern = new RegExp(`^INSERT INTO \`${TARGET_TABLE}\`(?:\\s|\\()`);
  if (!tablePattern.test(line)) return line;

  const valuesMarker = ' VALUES ';
  const markerIndex = line.indexOf(valuesMarker);
  if (markerIndex === -1) return line;

  let prefix = line.slice(0, markerIndex);
  const suffix = line.slice(markerIndex + valuesMarker.length);
  let valueIndex = 10;

  if (prefix.includes('(')) {
    const parsed = parseColumnList(prefix);
    if (parsed) {
      const columns = splitSqlList(parsed.columns).map(column => column.trim());
      const generatedIndex = columns.findIndex(
        column => column.replace(/`/g, '').toLowerCase() === GENERATED_COLUMN
      );
      if (generatedIndex !== -1) {
        columns.splice(generatedIndex, 1);
        prefix = `${parsed.before}${columns.join(',')}${parsed.after}`;
        valueIndex = generatedIndex;
      }
    }
  } else {
    prefix = `${prefix} (${TARGET_COLUMNS_WITHOUT_GENERATED.join(',')})`;
  }

  return `${prefix}${valuesMarker}${sanitizeValues(suffix, valueIndex)}`;
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on('line', line => {
  process.stdout.write(`${sanitizeInsertLine(line)}\n`);
});

rl.on('close', () => {
  process.stdout.end();
});
