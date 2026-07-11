const crypto = require('crypto');

function normalized(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value ?? null;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = stableValue(value[key]);
    return result;
  }, {});
}

function buildClientFileImportRequestHash({ actorStaffProfileId = null, fileName = null, worksheetName = null, rows = [] } = {}) {
  return sha256(JSON.stringify(stableValue({
    version: 1,
    actorStaffProfileId: Number(actorStaffProfileId) || null,
    fileName: normalized(fileName) || null,
    worksheetName: normalized(worksheetName) || null,
    rows: Array.isArray(rows) ? rows : [],
  })));
}

function buildClientFileImportIdentityKey(row = {}) {
  const normalizedRow = row?.normalized || row || {};
  const sin = String(normalizedRow.sin || '').replace(/\D/g, '');
  if (sin.length === 9) return `sin:${sha256(sin)}`;

  const email = normalized(normalizedRow.emailNormalized || normalizedRow.email);
  if (email) return `email:${sha256(email)}`;

  const firstName = normalized(normalizedRow.firstName);
  const lastName = normalized(normalizedRow.lastName);
  const dob = normalized(normalizedRow.dateOfBirth);
  if (firstName && lastName && dob) {
    return `name_dob:${sha256(`${firstName}|${lastName}|${dob}`)}`;
  }
  if (firstName && lastName) {
    return `name:${sha256(`${firstName}|${lastName}`)}`;
  }
  return null;
}

function reconcileClientFileImportCaseAction(caseRows = []) {
  const rows = Array.isArray(caseRows) ? caseRows : [];
  if (rows.length === 0) return { action: 'create_case', caseId: null };
  if (rows.length === 1) {
    return {
      action: 'update_case',
      caseId: Number(rows[0]?.id) || null,
      caseNumber: rows[0]?.case_number || null,
    };
  }
  const error = new Error('The client has multiple cases and requires review before import.');
  error.code = 'import_client_case_conflict';
  error.statusCode = 409;
  error.details = { caseIds: rows.map(row => Number(row?.id)).filter(Boolean) };
  throw error;
}

async function claimClientFileImportRun(connection, {
  requestHash,
  actorStaffProfileId = null,
  fileName = null,
  worksheetName = null,
} = {}) {
  if (!connection || typeof connection.query !== 'function' || !/^[a-f0-9]{64}$/.test(String(requestHash || ''))) {
    const error = new Error('A valid import request hash is required.');
    error.code = 'invalid_import_request_hash';
    error.statusCode = 422;
    throw error;
  }
  await connection.query(
    `INSERT INTO client_file_import_run
       (request_hash, status, actor_staff_profile_id, file_name, worksheet_name, created_at, updated_at)
     VALUES (?, 'processing', ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), updated_at = updated_at`,
    [requestHash, Number(actorStaffProfileId) || null, fileName || null, worksheetName || null]
  );
  const [[run]] = await connection.query(
    `SELECT id, request_hash, status, result_json
       FROM client_file_import_run
      WHERE request_hash = ?
      LIMIT 1 FOR UPDATE`,
    [requestHash]
  );
  if (!run) {
    const error = new Error('The import run claim could not be loaded.');
    error.code = 'import_run_claim_missing';
    throw error;
  }
  let result = run.result_json || null;
  if (typeof result === 'string') {
    try { result = JSON.parse(result); } catch (_) { result = null; }
  }
  return {
    id: Number(run.id),
    replay: run.status === 'committed' && Boolean(result),
    result,
  };
}

async function completeClientFileImportRun(connection, runId, result) {
  await connection.query(
    `UPDATE client_file_import_run
        SET status = 'committed', result_json = ?, committed_at = NOW(), updated_at = NOW()
      WHERE id = ?`,
    [JSON.stringify(result || {}), Number(runId)]
  );
}

async function claimClientFileImportIdentity(connection, identityKey, expectedClientId = null) {
  if (!identityKey) {
    const error = new Error('The import row has no stable identity key.');
    error.code = 'import_identity_key_missing';
    error.statusCode = 422;
    throw error;
  }
  await connection.query(
    `INSERT INTO client_file_import_identity_claim
       (identity_key, client_id, created_at, updated_at)
     VALUES (?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE identity_key = VALUES(identity_key)`,
    [identityKey, Number(expectedClientId) || null]
  );
  const [[claim]] = await connection.query(
    `SELECT identity_key, client_id
       FROM client_file_import_identity_claim
      WHERE identity_key = ?
      LIMIT 1 FOR UPDATE`,
    [identityKey]
  );
  const claimedClientId = Number(claim?.client_id) || null;
  const normalizedExpectedClientId = Number(expectedClientId) || null;
  if (claimedClientId && normalizedExpectedClientId && claimedClientId !== normalizedExpectedClientId) {
    const error = new Error('The import identity is already bound to a different client.');
    error.code = 'import_identity_client_conflict';
    error.statusCode = 409;
    error.details = { claimedClientId, expectedClientId: normalizedExpectedClientId };
    throw error;
  }
  return claimedClientId || normalizedExpectedClientId || null;
}

async function bindClientFileImportIdentity(connection, identityKey, clientId) {
  const numericClientId = Number(clientId);
  if (!identityKey || !Number.isInteger(numericClientId) || numericClientId <= 0) {
    const error = new Error('A valid import identity and client are required.');
    error.code = 'invalid_import_identity_binding';
    throw error;
  }
  const [result] = await connection.query(
    `UPDATE client_file_import_identity_claim
        SET client_id = ?, updated_at = NOW()
      WHERE identity_key = ?
        AND (client_id IS NULL OR client_id = ?)`,
    [numericClientId, identityKey, numericClientId]
  );
  if (Number(result?.affectedRows) !== 1) {
    const error = new Error('The import identity changed ownership during commit.');
    error.code = 'import_identity_client_conflict';
    error.statusCode = 409;
    throw error;
  }
}

module.exports = {
  bindClientFileImportIdentity,
  buildClientFileImportIdentityKey,
  buildClientFileImportRequestHash,
  claimClientFileImportIdentity,
  claimClientFileImportRun,
  completeClientFileImportRun,
  reconcileClientFileImportCaseAction,
};
