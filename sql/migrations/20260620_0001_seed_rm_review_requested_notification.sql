-- Seed the initial Regional Manager Pending Review arrival bell alert.
-- Email remains off until workflow-specific templates are configured.

INSERT INTO notification_setting (event, role, template_id, language, enabled, email_alert, bell_alert)
SELECT 'rm_review_requested', 'Regional Manager', NULL, 'en', 1, 0, 1
WHERE NOT EXISTS (
  SELECT 1
    FROM notification_setting
   WHERE event COLLATE utf8mb4_unicode_ci = 'rm_review_requested'
     AND role COLLATE utf8mb4_unicode_ci = 'Regional Manager'
     AND language COLLATE utf8mb4_unicode_ci = 'en'
);
