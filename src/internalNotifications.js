const NOTIFICATION_AUDIENCE = {
  GLOBAL: 'global',
  ROLE: 'role',
  USER: 'user',
};

function getRoleFromAuth(auth) {
  if (!auth) return null;
  return auth.role || auth.RoleName || auth.Role || null;
}

function normalizePositiveInt(value) {
  if (value === null || typeof value === 'undefined') return null;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return numeric;
}

function getStaffProfileIdFromAuth(auth) {
  if (!auth) return null;
  return normalizePositiveInt(
    auth.staff_profile_id ||
    auth.staffProfileId ||
    null
  );
}

function getApplicantUserIdFromAuth(auth) {
  if (!auth) return null;
  return normalizePositiveInt(
    auth.applicant_user_id ||
    auth.applicantUserId ||
    (auth.subjectType === 'applicant' ? (auth.user_id || auth.userId || auth.id) : null)
  );
}

async function getInternalNotifications(pool, auth) {
  const role = getRoleFromAuth(auth);
  const staffProfileId = getStaffProfileIdFromAuth(auth);
  const applicantUserId = getApplicantUserIdFromAuth(auth);

  if (!role && !staffProfileId && !applicantUserId) {
    return [];
  }

  const now = new Date();
  const params = [];
  const conditions = [];
  const dismissalConditions = [];
  const dismissalParams = [];

  conditions.push(`audience_type = '${NOTIFICATION_AUDIENCE.GLOBAL}'`);

  if (role) {
    conditions.push(`(audience_type = '${NOTIFICATION_AUDIENCE.ROLE}' AND audience_role = ?)`);
    params.push(role);
  }

  if (staffProfileId) {
    conditions.push(`(audience_type = '${NOTIFICATION_AUDIENCE.USER}' AND audience_actor_type = 'staff_profile' AND audience_staff_profile_id = ?)`);
    params.push(staffProfileId);
    dismissalConditions.push(`(d.viewer_actor_type = 'staff_profile' AND d.viewer_staff_profile_id = ?)`);
    dismissalParams.push(staffProfileId);
  }

  if (applicantUserId) {
    conditions.push(`(audience_type = '${NOTIFICATION_AUDIENCE.USER}' AND audience_actor_type = 'applicant_user' AND audience_applicant_user_id = ?)`);
    params.push(applicantUserId);
    dismissalConditions.push(`(d.viewer_actor_type = 'applicant_user' AND d.viewer_applicant_user_id = ?)`);
    dismissalParams.push(applicantUserId);
  }

  let sql = `SELECT id, event_key, severity, title, message, audience_type, audience_actor_type, audience_role,
    audience_staff_profile_id, audience_applicant_user_id,
    dismissible, requires_ack, starts_at, expires_at, metadata, created_by, created_at, updated_at, delivered_at
    FROM iset_internal_notification n
    WHERE (${conditions.join(' OR ')})
      AND (n.starts_at IS NULL OR n.starts_at <= ?)
      AND (n.expires_at IS NULL OR n.expires_at >= ?)`;

  params.push(now);
  params.push(now);

  if (dismissalConditions.length) {
    sql += ` AND NOT EXISTS (
      SELECT 1
        FROM iset_internal_notification_dismissal d
       WHERE d.notification_id = n.id
         AND (${dismissalConditions.join(' OR ')})
    )`;
    params.push(...dismissalParams);
  }

  sql += ' ORDER BY n.severity DESC, n.created_at DESC';

  const [rows] = await pool.query(sql, params);
  return rows || [];
}

async function dismissInternalNotification(pool, auth, notificationId) {
  const staffProfileId = getStaffProfileIdFromAuth(auth);
  const applicantUserId = getApplicantUserIdFromAuth(auth);
  const viewer = staffProfileId
    ? { actorType: 'staff_profile', staffProfileId, applicantUserId: null }
    : applicantUserId
      ? { actorType: 'applicant_user', staffProfileId: null, applicantUserId }
      : null;

  if (!viewer) {
    const err = new Error('Typed notification viewer context not available');
    err.statusCode = 401;
    throw err;
  }

  const [results] = await pool.query(
    `INSERT IGNORE INTO iset_internal_notification_dismissal (
       notification_id,
       viewer_actor_type,
       viewer_staff_profile_id,
       viewer_applicant_user_id
     )
     VALUES (?, ?, ?, ?)`,
    [
      notificationId,
      viewer.actorType,
      viewer.staffProfileId,
      viewer.applicantUserId
    ]
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
