/**
 * Repository helpers for the per-staff case watchlist.
 * These utilities wrap raw SQL so route handlers and background jobs can share logic.
 */

const isBuffer = (value) =>
  value && typeof value === 'object' && typeof value.copy === 'function' && Buffer.isBuffer(value);

let cachedColumnName = null;

async function resolveWatchColumn(pool) {
  if (cachedColumnName) return cachedColumnName;
  await ensurePool(pool);
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'iset_case_watch'
        AND COLUMN_NAME = 'staff_profile_id'
      LIMIT 1`
  );
  cachedColumnName = rows && rows.length ? 'staff_profile_id' : 'user_id';
  return cachedColumnName;
}

function resetWatchColumnCache() {
  cachedColumnName = null;
}

async function ensurePool(pool) {
  if (!pool || typeof pool.query !== 'function') {
    throw new Error('caseWatchRepository requires a MySQL pool with a query() method');
  }
}

function serializeMetadata(metadata) {
  if (metadata === null || typeof metadata === 'undefined') return null;
  if (typeof metadata === 'string') return metadata;
  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
}

function parseMetadata(raw) {
  if (raw === null || typeof raw === 'undefined') return null;
  if (typeof raw === 'object' && !isBuffer(raw)) return raw;
  const text = isBuffer(raw) ? raw.toString('utf8') : String(raw);
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function mapRow(row) {
  if (!row) return row;
  return {
    caseId: row.caseId,
    staffProfileId: row.staffProfileId,
    metadata: parseMetadata(row.metadata),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function createCaseWatch(pool, { caseId, staffProfileId, metadata = null }) {
  await ensurePool(pool);
  if (!caseId || !staffProfileId) {
    throw new Error('createCaseWatch requires caseId and staffProfileId');
  }

  const columnName = await resolveWatchColumn(pool);
  const payload = serializeMetadata(metadata);

  await pool.query(
    `INSERT INTO iset_case_watch (case_id, ${columnName}, metadata)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       metadata = VALUES(metadata),
       updated_at = CURRENT_TIMESTAMP(3)`,
    [caseId, staffProfileId, payload]
  );

  const [rows] = await pool.query(
    `SELECT case_id AS caseId, ${columnName} AS staffProfileId, metadata, created_at AS createdAt, updated_at AS updatedAt
       FROM iset_case_watch
      WHERE case_id = ? AND ${columnName} = ?
      LIMIT 1`,
    [caseId, staffProfileId]
  );

  return rows && rows.length ? mapRow(rows[0]) : null;
}

async function deleteCaseWatch(pool, { caseId, staffProfileId }) {
  await ensurePool(pool);
  if (!caseId || !staffProfileId) {
    throw new Error('deleteCaseWatch requires caseId and staffProfileId');
  }

  const columnName = await resolveWatchColumn(pool);
  const [result] = await pool.query(
    `DELETE FROM iset_case_watch WHERE case_id = ? AND ${columnName} = ?`,
    [caseId, staffProfileId]
  );

  return result && typeof result.affectedRows === 'number' ? result.affectedRows : 0;
}

async function listCaseWatchesForUser(pool, staffProfileId) {
  await ensurePool(pool);
  if (!staffProfileId) {
    throw new Error('listCaseWatchesForUser requires staffProfileId');
  }

  const columnName = await resolveWatchColumn(pool);
  const [rows] = await pool.query(
    `SELECT case_id AS caseId, metadata, created_at AS createdAt, updated_at AS updatedAt
       FROM iset_case_watch
      WHERE ${columnName} = ?
      ORDER BY created_at DESC`,
    [staffProfileId]
  );

  return (rows || []).map((row) =>
    mapRow({
      ...row,
      staffProfileId,
    })
  );
}

async function listWatchersForCase(pool, caseId) {
  await ensurePool(pool);
  if (!caseId) {
    throw new Error('listWatchersForCase requires caseId');
  }

  const columnName = await resolveWatchColumn(pool);
  const [rows] = await pool.query(
    `SELECT ${columnName} AS staffProfileId, metadata, created_at AS createdAt, updated_at AS updatedAt
       FROM iset_case_watch
      WHERE case_id = ?
      ORDER BY created_at ASC`,
    [caseId]
  );

  return (rows || []).map((row) =>
    mapRow({
      ...row,
      caseId,
    })
  );
}

module.exports = {
  createCaseWatch,
  deleteCaseWatch,
  listCaseWatchesForUser,
  listWatchersForCase,
  resetWatchColumnCache,
};
