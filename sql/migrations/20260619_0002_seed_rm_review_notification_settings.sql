-- Seed default bell-alert settings for the Regional Manager two-step review workflow.
-- Email delivery remains off by default until workflow-specific templates are configured.

INSERT INTO notification_setting (event, role, template_id, language, enabled, email_alert, bell_alert)
SELECT 'rm_review_returned_to_submitter', 'ISET Coordinator', NULL, 'en', 1, 0, 1
WHERE NOT EXISTS (
  SELECT 1
    FROM notification_setting
   WHERE event COLLATE utf8mb4_unicode_ci = 'rm_review_returned_to_submitter'
     AND role COLLATE utf8mb4_unicode_ci = 'ISET Coordinator'
     AND language COLLATE utf8mb4_unicode_ci = 'en'
);

INSERT INTO notification_setting (event, role, template_id, language, enabled, email_alert, bell_alert)
SELECT 'rm_review_changes_forwarded', 'ISET Coordinator', NULL, 'en', 1, 0, 1
WHERE NOT EXISTS (
  SELECT 1
    FROM notification_setting
   WHERE event COLLATE utf8mb4_unicode_ci = 'rm_review_changes_forwarded'
     AND role COLLATE utf8mb4_unicode_ci = 'ISET Coordinator'
     AND language COLLATE utf8mb4_unicode_ci = 'en'
);

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
SELECT 'nwac_review_changes_requested', 'Regional Manager', NULL, 'en', 1, 0, 1
WHERE NOT EXISTS (
  SELECT 1
    FROM notification_setting
   WHERE event COLLATE utf8mb4_unicode_ci = 'nwac_review_changes_requested'
     AND role COLLATE utf8mb4_unicode_ci = 'Regional Manager'
     AND language COLLATE utf8mb4_unicode_ci = 'en'
);
