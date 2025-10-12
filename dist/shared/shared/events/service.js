const { EVENT_SCOPE, getEventCatalog, getEventType } = require('./catalog');

let runtimeConfigEnsured = false;

async function ensureRuntimeConfigTable(pool) {
  if (runtimeConfigEnsured) return;
  await pool.query(
    "CREATE TABLE IF NOT EXISTS iset_runtime_config (id INT AUTO_INCREMENT PRIMARY KEY, scope VARCHAR(32) NOT NULL, k VARCHAR(128) NOT NULL, v JSON NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uniq_scope_key (scope,k)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  runtimeConfigEnsured = true;
}

function buildBaseState() {
  const categories = [];
  const categoryIndex = new Map();
  const typeIndex = new Map();

  for (const category of getEventCatalog()) {
    const categoryEntry = {
      id: category.id,
      label: category.label,
      description: category.description,
      severity: category.severity,
      source: category.source || null,
      enabled: true,
      locked: Boolean(category.locked),
      draft: Boolean(category.draft),
      updatedBy: null,
      updatedAt: null,
      types: []
    };

    for (const type of category.types) {
      const typeEntry = {
        id: type.id,
        label: type.label,
        severity: type.severity,
        source: type.source || null,
        draft: Boolean(type.draft),
        locked: Boolean(type.locked),
        enabled: type.locked ? true : true,
        updatedBy: null,
        updatedAt: null
      };
      categoryEntry.types.push(typeEntry);
      typeIndex.set(`${category.id}:${type.id}`, typeEntry);
    }

    categories.push(categoryEntry);
    categoryIndex.set(category.id, categoryEntry);
  }

  return { categories, categoryIndex, typeIndex };
}

async function loadEventCaptureState(pool) {
  await ensureRuntimeConfigTable(pool);
  const base = buildBaseState();
  const categories = base.categories;
  const categoryIndex = base.categoryIndex;
  const typeIndex = base.typeIndex;

  const [rows] = await pool.query(
    'SELECT k, v, updated_at FROM iset_runtime_config WHERE scope = ? ORDER BY updated_at DESC',
    [EVENT_SCOPE]
  );

  let latestUpdatedAt = null;

  for (const row of rows) {
    const key = row.k || '';
    if (!key) continue;
    let payload;
    if (row.v === null || typeof row.v === 'undefined') {
      payload = {};
    } else {
      try {
        payload = typeof row.v === 'string' ? JSON.parse(row.v) : row.v;
      } catch (err) {
        continue;
      }
    }

    const parts = key.split('.');
    if (parts.length === 0) continue;

    const categoryId = parts[0];
    const category = categoryIndex.get(categoryId);
    if (!category) continue;

    const updatedAt = payload.updated_at || row.updated_at;
    const updatedBy = payload.updated_by ?? null;

    if (parts.length === 1) {
      if (typeof payload.enabled === 'boolean') {
        category.enabled = payload.enabled;
      }
      if (updatedAt) category.updatedAt = updatedAt;
      if (updatedBy !== undefined) category.updatedBy = updatedBy;
    } else {
      const typeId = parts.slice(1).join('.');
      const typeEntry = typeIndex.get(`${categoryId}:${typeId}`);
      if (!typeEntry) continue;
      if (typeof payload.enabled === 'boolean') {
        typeEntry.enabled = payload.enabled;
      }
      if (updatedAt) typeEntry.updatedAt = updatedAt;
      if (updatedBy !== undefined) typeEntry.updatedBy = updatedBy;
    }

    if (updatedAt && (!latestUpdatedAt || new Date(updatedAt) > new Date(latestUpdatedAt))) {
      latestUpdatedAt = updatedAt;
    }
  }

  return {
    categories,
    updatedAt: latestUpdatedAt
  };
}

// TODO: enforce validation feedback (e.g., locked types) and integrate audit logging once compliance rules land.
// TODO: route updates through the forthcoming event outbox when asynchronous delivery is introduced.
async function updateEventCaptureRules(pool, updates, actorId) {
  if (!Array.isArray(updates) || updates.length === 0) {
    return loadEventCaptureState(pool);
  }

  await ensureRuntimeConfigTable(pool);

  const now = new Date().toISOString();

  for (const update of updates) {
    if (!update || typeof update !== 'object') continue;
    const categoryId = update.categoryId || update.category || null;
    const enabled = update.enabled;
    const typeId = update.typeId || update.eventType || null;

    if (!categoryId || typeof enabled !== 'boolean') {
      continue;
    }

    const catalogCategory = getEventCatalog().find(cat => cat.id === categoryId);
    if (!catalogCategory) {
      continue;
    }

    let targetKey = categoryId;
    if (typeId) {
      const catalogType = getEventType(typeId);
      if (!catalogType) {
        continue;
      }
      const resolvedCategory = catalogType.category || categoryId;
      if (catalogType.locked && enabled === false) {
        // Skip locked disables for now; in future we may surface an explicit error.
        continue;
      }
      targetKey = `${resolvedCategory}.${catalogType.id}`;
    }

    const payload = {
      enabled,
      updated_by: actorId ?? null,
      updated_at: now
    };

    await pool.query(
      "INSERT INTO iset_runtime_config (scope, k, v) VALUES (?, ?, CAST(? AS JSON)) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = CURRENT_TIMESTAMP",
      [EVENT_SCOPE, targetKey, JSON.stringify(payload)]
    );
  }

  try {
    const { invalidateCaptureCache } = require('./emitter');
    if (typeof invalidateCaptureCache === 'function') {
      invalidateCaptureCache();
    }
  } catch (err) {
    console.warn('[events] failed to invalidate capture cache', err ? err.message : err);
  }

  return loadEventCaptureState(pool);
}

module.exports = {
  ensureRuntimeConfigTable,
  loadEventCaptureState,
  updateEventCaptureRules
};







