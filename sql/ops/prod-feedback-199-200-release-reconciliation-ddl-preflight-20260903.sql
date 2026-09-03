-- Metadata-only PROD preflight for feedback reports 199 and 200.
-- Run immediately before the guarded reconciliation artifact and compare every
-- identifier in that finished artifact with this live output.

SELECT DATABASE(), @@hostname, CURRENT_USER(), USER(), VERSION();

SHOW CREATE TABLE staff_profiles;
SHOW FULL COLUMNS FROM staff_profiles;
SHOW INDEX FROM staff_profiles;

SHOW CREATE TABLE admin_feedback_report;
SHOW FULL COLUMNS FROM admin_feedback_report;
SHOW INDEX FROM admin_feedback_report;

SHOW CREATE TABLE admin_feedback_note;
SHOW FULL COLUMNS FROM admin_feedback_note;
SHOW INDEX FROM admin_feedback_note;

SHOW CREATE TABLE admin_feedback_status_history;
SHOW FULL COLUMNS FROM admin_feedback_status_history;
SHOW INDEX FROM admin_feedback_status_history;

SHOW PROCEDURE STATUS WHERE Db = DATABASE();
