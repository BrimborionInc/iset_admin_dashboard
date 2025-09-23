const sql = require('sql-template-strings');

const NOTIFICATION_AUDIENCE = {
  GLOBAL: 'global',
  ROLE: 'role',
  USER: 'user',
};

function getRoleFromAuth(auth) {
  if (!auth) return null;
  return auth.role || auth.RoleName || auth.Role || null;
}

function getUserIdFromAuth(auth) {
  if (!auth) return null;
  return auth.user_id || auth.userId || auth.id || null;
}

async function getInternalNotifications(pool, auth) {
  const role = getRoleFromAuth(auth);
  const userId = getUserIdFromAuth(auth);

  if (!role && !userId) {
    return [];
  }

  const now = new Date();
  const params = [];
  const conditions = [];

  conditions.push(`audience_type = '${NOTIFICATION_AUDIENCE.GLOBAL}'`);

  if (role) {
    conditions.push(`(audience_type = '${NOTIFICATION_AUDIENCE.ROLE}' AND audience_role = ?)`);
    params.push(role);
  }

  if (userId) {
    conditions.push(`(audience_type = '${NOTIFICATION_AUDIENCE.USER}' AND audience_user_id = ?)`);
    params.push(userId);
  }

  let sql = `SELECT id, event_key, severity, title, message, audience_type, audience_role, audience_user_id,
    dismissible, requires_ack, starts_at, expires_at, metadata, created_by, created_at, updated_at, delivered_at
    FROM iset_internal_notification
    WHERE (${conditions.join(' OR ')})
      AND (starts_at IS NULL OR starts_at <= ?)
      AND (expires_at IS NULL OR expires_at >= ?)`;

  params.push(now);
  params.push(now);

  sql += ` AND id NOT IN (
      SELECT notification_id FROM iset_internal_notification_dismissal WHERE user_id = ?
    )`;

  params.push(userId || 0);

  sql += ' ORDER BY severity DESC, created_at DESC';

  const [rows] = await pool.query(sql, params);
  return rows || [];
}

async function dismissInternalNotification(pool, auth, notificationId) {
  const userId = getUserIdFromAuth(auth);
  if (!userId) {
    const err = new Error('User context not available');
    err.statusCode = 401;
    throw err;
  }

  const [results] = await pool.query(
    `INSERT IGNORE INTO iset_internal_notification_dismissal (notification_id, user_id)
     VALUES (?, ?)`,
    [notificationId, userId]
  );

  if (!results || results.affectedRows === 0) {
    const err = new Error('Notification already dismissed or not found');
    err.statusCode = 404;
    throw err;
  }
}

module.exports = {
  getInternalNotifications,
  dismissInternalNotification,
};
