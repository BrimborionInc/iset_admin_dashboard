class IntacctRestEnvelopeError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'IntacctRestEnvelopeError';
    this.code = code;
    this.details = details;
  }
}

function parseMeta(payload) {
  const meta = payload && typeof payload === 'object' ? payload['ia::meta'] : null;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const totalError = Number(meta.totalError || 0);
  if (Number.isFinite(totalError) && totalError > 0) {
    throw new IntacctRestEnvelopeError(
      'intacct_rest_result_contains_errors',
      'Sage Intacct reported errors in a successful HTTP response.',
      { meta }
    );
  }
  return meta;
}

function extractIntacctRestResult(payload, { allowLegacyData = false } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new IntacctRestEnvelopeError(
      'intacct_rest_invalid_success_response',
      'Sage Intacct returned an invalid success response.'
    );
  }
  parseMeta(payload);
  if (Object.prototype.hasOwnProperty.call(payload, 'ia::result')) {
    return payload['ia::result'];
  }
  if (allowLegacyData && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload.data;
  }
  throw new IntacctRestEnvelopeError(
    'intacct_rest_invalid_success_response',
    'Sage Intacct success response did not contain ia::result.'
  );
}

function extractIntacctRestCollection(payload, options = {}) {
  const result = extractIntacctRestResult(payload, options);
  if (!Array.isArray(result)) {
    throw new IntacctRestEnvelopeError(
      'intacct_rest_invalid_collection_response',
      'Sage Intacct collection response did not contain an array result.'
    );
  }
  return result;
}

function extractIntacctRestObjectId(payload, options = {}) {
  const result = extractIntacctRestResult(payload, options);
  const candidate = result && !Array.isArray(result) && typeof result === 'object'
    ? result.id || result.key
    : null;
  const id = candidate === null || candidate === undefined ? '' : String(candidate).trim();
  if (!id) {
    throw new IntacctRestEnvelopeError(
      'intacct_rest_external_id_missing',
      'Sage Intacct accepted the request without returning a stable object ID.'
    );
  }
  return id;
}

module.exports = {
  IntacctRestEnvelopeError,
  extractIntacctRestCollection,
  extractIntacctRestObjectId,
  extractIntacctRestResult,
};
