-- Metadata-only PROD schema proof for the r19 post-deploy feedback reconciliation.
-- Target identity was proved immediately before this artifact:
-- database iset_intake, current user app_admin@%, host ip-172-16-0-77,
-- port 3306, MySQL 8.0.42.

SHOW CREATE TABLE admin_feedback_report;
SHOW FULL COLUMNS FROM admin_feedback_report;
SHOW INDEX FROM admin_feedback_report;

SHOW CREATE TABLE admin_feedback_note;
SHOW FULL COLUMNS FROM admin_feedback_note;
SHOW INDEX FROM admin_feedback_note;

SHOW CREATE TABLE admin_feedback_status_history;
SHOW FULL COLUMNS FROM admin_feedback_status_history;
SHOW INDEX FROM admin_feedback_status_history;
