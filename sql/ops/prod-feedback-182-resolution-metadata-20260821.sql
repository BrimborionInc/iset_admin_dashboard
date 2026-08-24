-- Live PROD schema proof for the canonical feedback 182 resolution audit.

SELECT DATABASE(),
       @@hostname,
       @@port,
       CURRENT_USER(),
       VERSION();

SHOW CREATE TABLE admin_feedback_report;
SHOW FULL COLUMNS FROM admin_feedback_report;
SHOW INDEX FROM admin_feedback_report;
SHOW TRIGGERS LIKE 'admin_feedback_report';

SHOW CREATE TABLE admin_feedback_status_history;
SHOW FULL COLUMNS FROM admin_feedback_status_history;
SHOW INDEX FROM admin_feedback_status_history;
SHOW TRIGGERS LIKE 'admin_feedback_status_history';

SHOW CREATE TABLE admin_feedback_note;
SHOW FULL COLUMNS FROM admin_feedback_note;
SHOW INDEX FROM admin_feedback_note;
SHOW TRIGGERS LIKE 'admin_feedback_note';
