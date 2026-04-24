-- TEST-only admin feedback queue reset prepared on 2026-04-24.
-- Purpose: clear the TEST bug / change-request log after verifying
-- there were no TEST-only reports left to merge into PROD.

START TRANSACTION;

SELECT
  (SELECT COUNT(*) FROM admin_feedback_report) AS reports_before,
  (SELECT COUNT(*) FROM admin_feedback_note) AS notes_before,
  (SELECT COUNT(*) FROM admin_feedback_status_history) AS status_history_before,
  (SELECT COUNT(*) FROM admin_feedback_attachment) AS attachments_before;

DELETE FROM admin_feedback_report;

ALTER TABLE admin_feedback_report AUTO_INCREMENT = 1;
ALTER TABLE admin_feedback_note AUTO_INCREMENT = 1;
ALTER TABLE admin_feedback_status_history AUTO_INCREMENT = 1;
ALTER TABLE admin_feedback_attachment AUTO_INCREMENT = 1;

SELECT
  (SELECT COUNT(*) FROM admin_feedback_report) AS reports_after,
  (SELECT COUNT(*) FROM admin_feedback_note) AS notes_after,
  (SELECT COUNT(*) FROM admin_feedback_status_history) AS status_history_after,
  (SELECT COUNT(*) FROM admin_feedback_attachment) AS attachments_after;

COMMIT;
