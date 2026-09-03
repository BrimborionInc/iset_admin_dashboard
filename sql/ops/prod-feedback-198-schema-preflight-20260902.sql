-- Metadata-only PROD preflight for feedback #198.
-- This file intentionally performs no ordinary read and no mutation.

SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

SHOW TABLES LIKE 'admin_feedback%';

SHOW CREATE TABLE admin_feedback_report;
SHOW FULL COLUMNS FROM admin_feedback_report;
SHOW INDEX FROM admin_feedback_report;

SHOW CREATE TABLE admin_feedback_status_history;
SHOW FULL COLUMNS FROM admin_feedback_status_history;
SHOW INDEX FROM admin_feedback_status_history;

SHOW CREATE TABLE admin_feedback_note;
SHOW FULL COLUMNS FROM admin_feedback_note;
SHOW INDEX FROM admin_feedback_note;
