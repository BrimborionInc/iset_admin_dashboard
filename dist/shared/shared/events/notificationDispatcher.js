const BELL_TEMPLATES = {
  application_submitted: ({ event, trackingId }) => {
    const ref = trackingId || event?.event_data?.reference_number || event?.event_data?.tracking_id || null;
    const submitter = (event?.actor && (event.actor.displayName || event.actor.email)) || null;
    const title = 'New application submitted';
    const messageParts = [];
    if (ref) {
      messageParts.push(`Application ${ref} has been submitted.`);
    } else {
      messageParts.push('A new application has been submitted.');
    }
    if (submitter) {
      messageParts.push(`Submitted by ${submitter}.`);
    }
    return {
      title,
      message: messageParts.join(' '),
      severity: 'info',
    };
  },
  case_assigned: ({ event }) => {
    const payload = event?.event_data || {};
    const tracking = payload.tracking_id || event?.tracking_id || null;
    const toLabel = payload.to_assignee_name || payload.to_assignee_email || 'the assigned user';
    const parts = ['Case assigned'];
    if (tracking) parts.push(`(${tracking})`);
    parts.push(`to ${toLabel}.`);
    return {
      title: 'Case assigned',
      message: parts.join(' '),
      severity: 'info',
    };
  },
  case_reassigned: ({ event }) => {
    const payload = event?.event_data || {};
    const tracking = payload.tracking_id || event?.tracking_id || null;
    const fromLabel = payload.from_assignee_name || payload.from_assignee_email || 'previous assignee';
    const toLabel = payload.to_assignee_name || payload.to_assignee_email || 'new assignee';
    const parts = ['Case reassigned'];
    if (tracking) parts.push(`(${tracking})`);
    parts.push(`from ${fromLabel} to ${toLabel}.`);
    return {
      title: 'Case reassigned',
      message: parts.join(' '),
      severity: 'info',
    };
  },
};

const ROLE_TYPE = 'role';
const USER_TYPE = 'user';

const APPLICANT_ROLE_KEY = 'applicant';
const APPLICATION_ASSESSOR_ROLE_KEY = 'application assessor';
const REGIONAL_COORDINATOR_ROLE_KEY = 'regional coordinator';

function normaliseRole(role = '') {
  return String(role || '').trim();
}

function normaliseRoleKey(role = '') {
  return normaliseRole(role).toLowerCase();
}

function formatNotificationContent(event) {
  const trackingId = event?.tracking_id || event?.event_data?.tracking_id || event?.event_data?.reference_number || null;
  const formatter = BELL_TEMPLATES[event?.event_type];
  if (typeof formatter === 'function') {
    return formatter({ event, trackingId }) || {};
  }
  const baseTitle = event?.event_type_label || 'New event';
  const messageParts = [baseTitle];
  if (trackingId) {
    messageParts.push(`Tracking ID: ${trackingId}`);
  }
  return {
    title: baseTitle,
    message: messageParts.join(' - '),
    severity: event?.severity || 'info',
  };
}

async function loadCaseContext(pool, caseId) {
  if (!caseId) return null;
  const [rows] = await pool.query(
    `SELECT c.id, c.assigned_to_user_id AS assigned_to, s.user_id AS applicant_id
       FROM iset_case c
       LEFT JOIN iset_application a ON a.id = c.application_id
       LEFT JOIN iset_application_submission s ON s.id = a.submission_id
      WHERE c.id = ?
      LIMIT 1`,
    [caseId]
  );
  return rows && rows[0] ? rows[0] : null;
}

async function resolveAudienceForSetting(pool, setting, event, caseContext) {
  const roleKey = normaliseRoleKey(setting.role);
  if (roleKey === APPLICANT_ROLE_KEY) {
    const applicantId = caseContext?.applicant_id;
    if (!applicantId) return [];
    return [{
      audience_type: USER_TYPE,
      audience_user_id: applicantId,
      audience_role: null,
    }];
  }
  if (roleKey === APPLICATION_ASSESSOR_ROLE_KEY || roleKey === REGIONAL_COORDINATOR_ROLE_KEY) {
    const assigneeId = caseContext?.assigned_to;
    if (!assigneeId) return [];
    return [{
      audience_type: USER_TYPE,
      audience_user_id: assigneeId,
      audience_role: null,
    }];
  }
  return [{
    audience_type: ROLE_TYPE,
    audience_role: normaliseRole(setting.role),
    audience_user_id: null,
  }];
}

async function notificationExists(pool, params) {
  const { eventType, eventId, audience_type, audience_role, audience_user_id } = params;
  const [rows] = await pool.query(
    `SELECT id FROM iset_internal_notification
      WHERE event_key = ?
        AND audience_type = ?
        AND IFNULL(audience_role, '') = IFNULL(?, '')
        AND IFNULL(audience_user_id, 0) = IFNULL(?, 0)
        AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.eventId')) = ?
      LIMIT 1`,
    [eventType, audience_type, audience_role || null, audience_user_id || null, eventId]
  );
  return rows && rows.length > 0;
}

async function dispatchInternalNotifications({ pool, event, logger = console }) {
  try {
    if (!event || !event.event_type) return;
    const [settings] = await pool.query(
      `SELECT id, event, role, language, enabled, email_alert, bell_alert
         FROM notification_setting
        WHERE event = ?
          AND enabled = 1
          AND COALESCE(bell_alert, 0) <> 0`,
      [event.event_type]
    );

    if (!settings || settings.length === 0) return;

    const caseId = event.case_id || (event.subject_type === 'case' ? Number(event.subject_id) : null);
    const caseContext = caseId ? await loadCaseContext(pool, caseId) : null;

    const content = formatNotificationContent(event);
    const severity = (content.severity || event.severity || 'info').toLowerCase();
    const trackingId = event.event_data?.tracking_id || event.event_data?.reference_number || null;

    for (const setting of settings) {
      try {
        const audiences = await resolveAudienceForSetting(pool, setting, event, caseContext);
        if (!audiences.length) continue;

        for (const audience of audiences) {
          const exists = await notificationExists(pool, {
            eventType: event.event_type,
            eventId: event.id,
            audience_type: audience.audience_type,
            audience_role: audience.audience_role,
            audience_user_id: audience.audience_user_id,
          });
          if (exists) continue;

          const metadata = {
            eventId: event.id,
            caseId,
            trackingId,
            eventType: event.event_type,
            role: setting.role,
          };

          await pool.query(
            `INSERT INTO iset_internal_notification (
                event_key,
                severity,
                title,
                message,
                audience_type,
                audience_role,
                audience_user_id,
                dismissible,
                requires_ack,
                metadata
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON))`,
            [
              event.event_type,
              severity,
              content.title || event.event_type_label || 'Notification',
              content.message || event.event_type_label || event.event_type,
              audience.audience_type,
              audience.audience_role || null,
              audience.audience_user_id || null,
              1,
              0,
              JSON.stringify(metadata),
            ]
          );
        }
      } catch (settingErr) {
        if (logger && typeof logger.warn === 'function') {
          logger.warn('[notifications] bell dispatch failed for setting', setting?.id, settingErr?.message || settingErr);
        }
      }
    }
  } catch (err) {
    if (logger && typeof logger.error === 'function') {
      logger.error('[notifications] bell dispatch failed', err?.message || err);
    }
  }
}

module.exports = {
  dispatchInternalNotifications,
};


