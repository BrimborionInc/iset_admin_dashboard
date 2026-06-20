-- One-off activation and notification normalization for Regional Manager two-step review.
-- Intended targets: TEST and PROD after schema migrations through 20260620_0002 are deployed.
-- Email alerts remain disabled until workflow-specific email templates are configured.

SELECT 'before_runtime_flag' AS checkpoint, scope, k, JSON_PRETTY(v) AS value_json
  FROM iset_runtime_config
 WHERE scope = 'feature_flags'
   AND k = 'workflow.two_step_rm_review.enabled';

SELECT 'before_notification_settings' AS checkpoint,
       event, role, language, enabled, email_alert, bell_alert, template_id
  FROM notification_setting
 WHERE event IN (
   'assessment_submitted',
   'rm_review_requested',
   'rm_review_returned_to_submitter',
   'rm_review_changes_forwarded',
   'rm_review_submitted_to_nwac',
   'nwac_review_changes_requested'
 )
 ORDER BY event, role, language, id;

START TRANSACTION;

INSERT INTO iset_runtime_config (scope, k, v)
VALUES (
  'feature_flags',
  'workflow.two_step_rm_review.enabled',
  CAST('{"enabled": true, "workflows": {"application_assessment": true, "intervention_proposal": true, "intervention_revision": true}}' AS JSON)
)
ON DUPLICATE KEY UPDATE
  v = VALUES(v),
  updated_at = NOW();

INSERT INTO notification_setting (event, role, template_id, language, enabled, email_alert, bell_alert)
SELECT 'rm_review_requested', 'Regional Manager', NULL, 'en', 1, 0, 1
WHERE NOT EXISTS (
  SELECT 1
    FROM notification_setting
   WHERE event COLLATE utf8mb4_unicode_ci = 'rm_review_requested'
     AND role COLLATE utf8mb4_unicode_ci = 'Regional Manager'
     AND language COLLATE utf8mb4_unicode_ci = 'en'
);

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
SELECT 'rm_review_submitted_to_nwac', 'System Administrator', NULL, 'en', 1, 0, 1
WHERE NOT EXISTS (
  SELECT 1
    FROM notification_setting
   WHERE event COLLATE utf8mb4_unicode_ci = 'rm_review_submitted_to_nwac'
     AND role COLLATE utf8mb4_unicode_ci = 'System Administrator'
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

UPDATE notification_setting
   SET enabled = 1,
       email_alert = 0,
       bell_alert = 1,
       template_id = NULL,
       updated_at = NOW()
 WHERE language COLLATE utf8mb4_unicode_ci = 'en'
   AND (
     (event COLLATE utf8mb4_unicode_ci = 'rm_review_requested'
       AND role COLLATE utf8mb4_unicode_ci = 'Regional Manager')
     OR (event COLLATE utf8mb4_unicode_ci = 'rm_review_returned_to_submitter'
       AND role COLLATE utf8mb4_unicode_ci = 'ISET Coordinator')
     OR (event COLLATE utf8mb4_unicode_ci = 'rm_review_changes_forwarded'
       AND role COLLATE utf8mb4_unicode_ci = 'ISET Coordinator')
     OR (event COLLATE utf8mb4_unicode_ci = 'rm_review_submitted_to_nwac'
       AND role COLLATE utf8mb4_unicode_ci IN ('NWAC Administrator', 'System Administrator'))
     OR (event COLLATE utf8mb4_unicode_ci = 'nwac_review_changes_requested'
       AND role COLLATE utf8mb4_unicode_ci = 'Regional Manager')
   );

UPDATE notification_setting
   SET enabled = 0,
       email_alert = 0,
       bell_alert = 0,
       template_id = NULL,
       updated_at = NOW()
 WHERE event COLLATE utf8mb4_unicode_ci = 'assessment_submitted'
   AND role COLLATE utf8mb4_unicode_ci IN ('NWAC Administrator', 'System Administrator', 'Regional Manager');

COMMIT;

SELECT 'after_runtime_flag' AS checkpoint, scope, k, JSON_PRETTY(v) AS value_json
  FROM iset_runtime_config
 WHERE scope = 'feature_flags'
   AND k = 'workflow.two_step_rm_review.enabled';

SELECT 'after_notification_settings' AS checkpoint,
       event, role, language, enabled, email_alert, bell_alert, template_id
  FROM notification_setting
 WHERE event IN (
   'assessment_submitted',
   'rm_review_requested',
   'rm_review_returned_to_submitter',
   'rm_review_changes_forwarded',
   'rm_review_submitted_to_nwac',
   'nwac_review_changes_requested'
 )
 ORDER BY event, role, language, id;
