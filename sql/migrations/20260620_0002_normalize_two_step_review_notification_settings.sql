-- Normalize bell-alert settings for the Regional Manager two-step review workflow.
-- Admin users should not receive initial submit-for-review alerts; those belong to RM.
-- Admin users should receive RM-submit-for-final-decision alerts.

UPDATE notification_setting
   SET enabled = 0,
       email_alert = 0,
       bell_alert = 0,
       template_id = NULL,
       updated_at = NOW()
 WHERE event COLLATE utf8mb4_unicode_ci = 'assessment_submitted'
   AND role COLLATE utf8mb4_unicode_ci IN ('NWAC Administrator', 'System Administrator');

INSERT INTO notification_setting (event, role, template_id, language, enabled, email_alert, bell_alert)
SELECT 'rm_review_submitted_to_nwac', 'NWAC Administrator', NULL, 'en', 1, 0, 1
WHERE NOT EXISTS (
  SELECT 1
    FROM notification_setting
   WHERE event COLLATE utf8mb4_unicode_ci = 'rm_review_submitted_to_nwac'
     AND role COLLATE utf8mb4_unicode_ci = 'NWAC Administrator'
     AND language COLLATE utf8mb4_unicode_ci = 'en'
);

INSERT INTO notification_setting (event, role, template_id, language, enabled, email_alert, bell_alert)
SELECT 'rm_review_submitted_to_nwac', 'System Administrator', NULL, 'en', 1, 0, 1
WHERE NOT EXISTS (
  SELECT 1
    FROM notification_setting
   WHERE event COLLATE utf8mb4_unicode_ci = 'rm_review_submitted_to_nwac'
     AND role COLLATE utf8mb4_unicode_ci = 'System Administrator'
     AND language COLLATE utf8mb4_unicode_ci = 'en'
);

UPDATE notification_setting
   SET enabled = 1,
       email_alert = 0,
       bell_alert = 1,
       template_id = NULL,
       updated_at = NOW()
 WHERE event COLLATE utf8mb4_unicode_ci = 'rm_review_submitted_to_nwac'
   AND role COLLATE utf8mb4_unicode_ci IN ('NWAC Administrator', 'System Administrator')
   AND language COLLATE utf8mb4_unicode_ci = 'en';
