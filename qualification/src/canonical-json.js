'use strict';

const { createHash } = require('node:crypto');
const { TextDecoder } = require('node:util');

const CANONICALIZATION_PROFILE = 'RQ-C14N-1';
const DIGEST_ALGORITHM = 'sha256';

class CanonicalJsonError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CanonicalJsonError';
    this.code = code;
    this.details = details;
  }
}

function assertUnicodeScalarString(value, path) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new CanonicalJsonError('UNSUPPORTED_UNICODE', `Unpaired high surrogate at ${path}`, { path });
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new CanonicalJsonError('UNSUPPORTED_UNICODE', `Unpaired low surrogate at ${path}`, { path });
    }
  }
}

function compareUnicodeScalars(left, right) {
  const leftPoints = Array.from(left, (character) => character.codePointAt(0));
  const rightPoints = Array.from(right, (character) => character.codePointAt(0));
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    if (leftPoints[index] !== rightPoints[index]) {
      return leftPoints[index] - rightPoints[index];
    }
  }
  return leftPoints.length - rightPoints.length;
}

function canonicalize(value) {
  const active = new Set();

  function serialize(current, path) {
    if (current === null) return 'null';
    if (current === true) return 'true';
    if (current === false) return 'false';

    if (typeof current === 'string') {
      assertUnicodeScalarString(current, path);
      return JSON.stringify(current.normalize('NFC'));
    }

    if (typeof current === 'number') {
      if (!Number.isSafeInteger(current) || Object.is(current, -0)) {
        throw new CanonicalJsonError(
          'UNSUPPORTED_NUMBER',
          `Only safe integers other than negative zero are supported at ${path}`,
          { path, value: current },
        );
      }
      return String(current);
    }

    if (typeof current !== 'object') {
      throw new CanonicalJsonError('UNSUPPORTED_VALUE', `Unsupported value at ${path}`, {
        path,
        valueType: typeof current,
      });
    }

    if (active.has(current)) {
      throw new CanonicalJsonError('CYCLIC_VALUE', `Cyclic value at ${path}`, { path });
    }
    active.add(current);

    try {
      if (Array.isArray(current)) {
        for (let index = 0; index < current.length; index += 1) {
          if (!Object.prototype.hasOwnProperty.call(current, index)) {
            throw new CanonicalJsonError('SPARSE_ARRAY', `Sparse array at ${path}`, { path, index });
          }
        }
        return `[${current.map((item, index) => serialize(item, `${path}[${index}]`)).join(',')}]`;
      }

      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new CanonicalJsonError('UNSUPPORTED_OBJECT', `Non-plain object at ${path}`, { path });
      }

      const normalizedKeys = new Map();
      for (const key of Object.keys(current)) {
        assertUnicodeScalarString(key, `${path} key`);
        const normalized = key.normalize('NFC');
        if (normalizedKeys.has(normalized)) {
          throw new CanonicalJsonError(
            'DUPLICATE_CANONICAL_KEY',
            `Object keys collide after Unicode normalization at ${path}`,
            { path, firstKey: normalizedKeys.get(normalized), secondKey: key },
          );
        }
        normalizedKeys.set(normalized, key);
      }

      return `{${[...normalizedKeys.entries()]
        .sort(([left], [right]) => compareUnicodeScalars(left, right))
        .map(([normalized, original]) => `${JSON.stringify(normalized)}:${serialize(current[original], `${path}.${normalized}`)}`)
        .join(',')}}`;
    } finally {
      active.delete(current);
    }
  }

  return serialize(value, '$');
}

function digestCanonical(value) {
  return createHash(DIGEST_ALGORITHM).update(canonicalize(value), 'utf8').digest('hex');
}

function digestBytes(value) {
  if (!(typeof value === 'string' || Buffer.isBuffer(value) || value instanceof Uint8Array)) {
    throw new CanonicalJsonError('INVALID_DIGEST_INPUT', 'Byte digest input must be a string or byte array');
  }
  return createHash(DIGEST_ALGORITHM).update(value).digest('hex');
}

function computeArtifactDigest(artifact) {
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    throw new CanonicalJsonError('INVALID_ARTIFACT', 'Artifact must be a plain JSON object');
  }
  const digestInput = { ...artifact };
  delete digestInput.contentDigest;
  return { algorithm: DIGEST_ALGORITHM, value: digestCanonical(digestInput) };
}

function parseStrictJson(input) {
  let source;
  if (Buffer.isBuffer(input) || input instanceof Uint8Array) {
    try {
      source = new TextDecoder('utf-8', { fatal: true }).decode(input);
    } catch (error) {
      throw new CanonicalJsonError('INVALID_UTF8', 'Input is not valid UTF-8', { cause: error.message });
    }
  } else if (typeof input === 'string') {
    source = input;
  } else {
    throw new CanonicalJsonError('INVALID_INPUT', 'Strict JSON input must be a string or byte array');
  }

  if (source.charCodeAt(0) === 0xfeff) {
    throw new CanonicalJsonError('UNSUPPORTED_BOM', 'A UTF-8 BOM is not permitted');
  }

  let index = 0;
  const fail = (code, message) => {
    throw new CanonicalJsonError(code, `${message} at byte-compatible character offset ${index}`, { offset: index });
  };
  const skipWhitespace = () => {
    while (index < source.length && /[\x20\x09\x0a\x0d]/u.test(source[index])) index += 1;
  };

  function parseString() {
    const start = index;
    index += 1;
    let escaped = false;
    while (index < source.length) {
      const code = source.charCodeAt(index);
      if (!escaped && code === 0x22) {
        index += 1;
        let value;
        try {
          value = JSON.parse(source.slice(start, index));
        } catch (error) {
          fail('MALFORMED_JSON', `Malformed JSON string: ${error.message}`);
        }
        assertUnicodeScalarString(value, `$ input offset ${start}`);
        return value;
      }
      if (!escaped && code < 0x20) fail('MALFORMED_JSON', 'Unescaped control character');
      if (!escaped && code === 0x5c) {
        escaped = true;
      } else {
        escaped = false;
      }
      index += 1;
    }
    fail('MALFORMED_JSON', 'Unterminated JSON string');
  }

  function parseNumber() {
    const match = source.slice(index).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u);
    if (!match) fail('MALFORMED_JSON', 'Malformed JSON number');
    const token = match[0];
    index += token.length;
    if (/[.eE]/u.test(token) || token === '-0') {
      fail('UNSUPPORTED_NUMBER', 'Only safe integer JSON numbers other than negative zero are supported');
    }
    const value = Number(token);
    if (!Number.isSafeInteger(value)) fail('UNSUPPORTED_NUMBER', 'JSON integer exceeds the safe range');
    return value;
  }

  function parseArray() {
    const result = [];
    index += 1;
    skipWhitespace();
    if (source[index] === ']') {
      index += 1;
      return result;
    }
    while (index < source.length) {
      result.push(parseValue());
      skipWhitespace();
      if (source[index] === ']') {
        index += 1;
        return result;
      }
      if (source[index] !== ',') fail('MALFORMED_JSON', 'Expected comma or closing bracket');
      index += 1;
      skipWhitespace();
    }
    fail('MALFORMED_JSON', 'Unterminated array');
  }

  function parseObject() {
    const result = Object.create(null);
    const keys = new Set();
    const normalizedKeys = new Set();
    index += 1;
    skipWhitespace();
    if (source[index] === '}') {
      index += 1;
      return result;
    }
    while (index < source.length) {
      if (source[index] !== '"') fail('MALFORMED_JSON', 'Expected object key');
      const key = parseString();
      const normalized = key.normalize('NFC');
      if (keys.has(key) || normalizedKeys.has(normalized)) {
        fail('DUPLICATE_KEY', `Duplicate object key ${JSON.stringify(key)}`);
      }
      keys.add(key);
      normalizedKeys.add(normalized);
      skipWhitespace();
      if (source[index] !== ':') fail('MALFORMED_JSON', 'Expected colon after object key');
      index += 1;
      result[key] = parseValue();
      skipWhitespace();
      if (source[index] === '}') {
        index += 1;
        return result;
      }
      if (source[index] !== ',') fail('MALFORMED_JSON', 'Expected comma or closing brace');
      index += 1;
      skipWhitespace();
    }
    fail('MALFORMED_JSON', 'Unterminated object');
  }

  function parseValue() {
    skipWhitespace();
    const character = source[index];
    if (character === '"') return parseString();
    if (character === '{') return parseObject();
    if (character === '[') return parseArray();
    if (character === '-' || (character >= '0' && character <= '9')) return parseNumber();
    if (source.startsWith('true', index)) {
      index += 4;
      return true;
    }
    if (source.startsWith('false', index)) {
      index += 5;
      return false;
    }
    if (source.startsWith('null', index)) {
      index += 4;
      return null;
    }
    fail('MALFORMED_JSON', 'Unexpected JSON token');
  }

  const value = parseValue();
  skipWhitespace();
  if (index !== source.length) fail('MALFORMED_JSON', 'Trailing content');
  return value;
}

module.exports = {
  CANONICALIZATION_PROFILE,
  DIGEST_ALGORITHM,
  CanonicalJsonError,
  canonicalize,
  computeArtifactDigest,
  digestBytes,
  digestCanonical,
  parseStrictJson,
};
